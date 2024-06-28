const AWS = require('aws-sdk');
const logger = require('./logger');
const path = require('path');

class S3DB {
  constructor(bucketName, prefix = '') {
    if (typeof bucketName !== 'string') {
      throw new Error(`Invalid bucket name: ${bucketName}. Bucket name must be a string.`);
    }

    if (typeof prefix !== 'string') {
      throw new Error(`Invalid prefix: ${prefix}. Prefix must be a string.`);
    }

    this.bucketName = bucketName;
    this.prefix = prefix;

    // Create an S3 instance
    this.s3 = new AWS.S3();
  }

  async putBlob(key, data) {
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
      Body: data,
    };

    logger.trace(`S3DB: Uploading object: s3://${this.bucketName}/${s3Key}`);
    await this.s3.upload(params).promise();
  }

  async put(key, data, options = {}) {
    key = ensureJsonExtension(key);
    let body = null;
    if (options.formatForReadability) {
      body = JSON.stringify(data, null, 2);
    } else {
      body = JSON.stringify(data);
    }

    await this.putBlob(key, body);
  }

  async getBlob(key, options = {}) {
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };
    logger.trace(`S3DB: Retrieving object: s3://${this.bucketName}/${s3Key}`);

    try {
      const data = await this.s3.getObject(params).promise();
      return data.Body;
    } catch (err) {
      if (err.code === 'NoSuchKey' && options.returnNullIfNotFound) {
        logger.trace(`S3DB: Object not found: s3://${this.bucketName}/${s3Key}`);
        return null;
      }
      throw err;
    }
  }

  async get(key, options = {}) {
    key = ensureJsonExtension(key);
    const body = await this.getBlob(key, options);

    if (body === null) {
      return null;
    }

    try {
      return JSON.parse(body.toString());
    } catch (err) {
      throw new Error(`Failed to parse JSON data for key ${key}: ${err.message}`);
    }
  }

  // getBlob returns a buffer, so if we want it as a string, here's a handy
  // wrapper function to convert it to a string
  async getString(key, options = {}) {
    const encoding = options.encoding || 'utf-8';
    const body = await this.getBlob(key, options);
    return body ? body.toString(encoding) : null;
  }

  async deleteBlob(key) {
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    logger.trace(`S3DB Deleting object: s3://${this.bucketName}/${s3Key}`);
    await this.s3.deleteObject(params).promise();
  }

  async delete(key) {
    key = ensureJsonExtension(key);
    await this.deleteBlob(key);
  }

  async update(key, newData) {
    const existingData = await this.get(key);
    const updatedData = { ...existingData, ...newData };

    await this.put(key, updatedData);
  }

  // List all keys in the bucket with the given prefix
  // If a subPath is provided, it will be appended to the prefix provided
  // in the constructor.
  // For example, if you have the following files on S3:
  // s3://mybucket/myprefix/mysubpath/key1.json
  // s3://mybucket/myprefix/mysubpath/key2.json
  // s3://mybucket/myprefix/mysubpath/subkey/sbkey1.json
  // and you call list('mysubpath'), it will return:
  // ['key1', 'key2', 'subkey/sbkey1']
  // Note that this will return only the keys, not the actual objects.
  async list(subPath = '') {
    // Check that subPath is a string
    if (typeof subPath !== 'string') {
      throw new Error(`Invalid subPath: ${subPath}. SubPath must be a string.`);
    }

    // if a subPath is provided, join that with the already set prefix
    let fullPrefix = this.prefix;
    if (subPath) {
      fullPrefix = joinPath(this.prefix, subPath);
    }
    // Ensure fullPrefix does not have a trailing '/'
    fullPrefix = fullPrefix.endsWith('/') ? fullPrefix.slice(0, -1) : fullPrefix;

    const params = {
      Bucket: this.bucketName,
      Prefix: fullPrefix,
    };

    const allKeys = [];
    let isTruncated = true;
    let iteration = 0;
    while (isTruncated) {
      iteration++;
      try {
        const data = await this.s3.listObjects(params).promise();
        allKeys.push(...data.Contents.map((obj) => obj.Key.replace(fullPrefix + '/', '').replace('.json', '')));
        isTruncated = data.IsTruncated;
        if (isTruncated) {
          params.Marker = data.Contents[data.Contents.length - 1].Key;
        }
        logger.trace(`S3DB: Iteration ${iteration}, retrieved ${data.Contents.length} keys from: s3://${this.bucketName}/${fullPrefix}`);
      } catch (err) {
        throw new Error(`Failed to list objects in bucket ${this.bucketName} with prefix ${fullPrefix}: ${err.message}`);
      }
    }
    logger.trace(`S3DB: Total ${allKeys.length} keys retrieved from: s3://${this.bucketName}/${fullPrefix}`);
    return allKeys;
  }

  async existsFullyQualified(key) {
    const params = {
      Bucket: this.bucketName,
      Key: key,
    };

    try {
      logger.trace(`S3DB: Checking for object existence at: s3://${this.bucketName}/${key}`);
      await this.s3.headObject(params).promise();
      logger.trace(`S3DB: Object exists: s3://${this.bucketName}/${key}`);
      return true;
    } catch (err) {
      if (err.code === 'NotFound') {
        logger.trace(`S3DB: Object does not exist: s3://${this.bucketName}/${key}`);
        return false;
      }
      logger.error(`S3DB: Error checking if object exists: s3://${this.bucketName}/${key}`, err);
      throw err;
    }
  }

  async existsBlob(key) {
    const s3Key = joinPath(this.prefix, key); // Construct the fully qualified key
    return await this.existsFullyQualified(s3Key); // Delegate to existsFullyQualified
  }

  async exists(key) {
    key = ensureJsonExtension(key); // Ensure the key has a JSON extension
    const s3Key = joinPath(this.prefix, key); // Construct the fully qualified key
    return await this.existsFullyQualified(s3Key); // Delegate to existsFullyQualified
  }

  async copy(relativeKey, newRelativeKey) {
    relativeKey = ensureJsonExtension(relativeKey);
    newRelativeKey = ensureJsonExtension(newRelativeKey);
    const sourcePath = path.join(this.prefix, relativeKey);
    const destinationPath = path.join(this.prefix, newRelativeKey); // Ensure newPath is correctly prefixed for logging
    logger.trace(`S3DB: Attempting to copy from ${sourcePath} to ${destinationPath}`);
    await this.copyFullyQualified(sourcePath, destinationPath);
  }

  async move(relativeKey, newRelativeKey) {
    relativeKey = ensureJsonExtension(relativeKey);
    newRelativeKey = ensureJsonExtension(newRelativeKey);
    const sourcePath = path.join(this.prefix, relativeKey);
    const destinationPath = path.join(this.prefix, newRelativeKey); // Ensure newPath is correctly prefixed for logging
    logger.trace(`S3DB: Attempting to move from ${sourcePath} to ${destinationPath}`);
    await this.moveFullyQualified(sourcePath, destinationPath);
  }
  
  // you need to specify the entire path for the source and destination,
  // including file extension, this method will not append '.json' to the keys
  async copyFullyQualified(sourcePath, destinationPath) {
    // Check if the source object exists
    const sourceExists = await this.existsFullyQualified(sourcePath);
    if (!sourceExists) {
      const errorMsg = `S3DB: Error copying object from ${sourcePath} to ${destinationPath}: The specified source key does not exist.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const copyParams = {
      Bucket: this.bucketName,
      CopySource: `${this.bucketName}/${sourcePath}`,
      Key: destinationPath,
    };

    try {
      await this.s3.copyObject(copyParams).promise();
      logger.trace(`S3DB: Copied object from ${sourcePath} to ${destinationPath}`);
    } catch (err) {
      logger.error(`S3DB: Error copying object from ${sourcePath} to ${destinationPath}: ${err.message}`);
      throw err;
    }
  }

  // you need to specify the entire path for the source and destination,
  // including file extension, this method will not append '.json' to the keys
  async moveFullyQualified(sourcePath, destinationPath) {
    // Use copyFullyQualified for the copy part of the move operation
    await this.copyFullyQualified(sourcePath, destinationPath);

    // Then delete the original object
    const deleteParams = {
      Bucket: this.bucketName,
      Key: sourcePath,
    };

    try {
      await this.s3.deleteObject(deleteParams).promise();
      logger.trace(`S3DB: Deleted original object at ${sourcePath}`);
    } catch (err) {
      logger.error(`S3DB: Error deleting original object at ${sourcePath}: ${err.message}`);
      throw err;
    }
  }

}

// Helper function to join path parts
// This function will join the parts with a '/' and remove any extra '/'
// It will also remove the trailing '/' if the path is not the root path
// e.g. joinPath('a', 'b', 'c') => 'a/b/c'
// e.g. joinPath('a/', '/b', 'c/') => 'a/b/c'
function joinPath(...parts) {
  // let path = parts.filter(part => part !== '').join('/');
  // if (path.endsWith('/') && path.length > 1) {
  //   path = path.slice(0, -1);
  // }
  // return path;
  return path.join(...parts);
}

function ensureJsonExtension(key) {
  // Convert key to string if it's not already a string
  if (typeof key !== 'string') {
    key = String(key);
  }

  // Append '.json' if key doesn't already have an extension
  if (!key.endsWith('.json')) {
    key += '.json';
  }

  return key;
}

module.exports = S3DB;
