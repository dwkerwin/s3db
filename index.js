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

  async getBlob(key) {
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
      if (err.code === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }

  async get(key, options = {}) {
    key = ensureJsonExtension(key);
    const body = await this.getBlob(key);

    if (body === null && options.returnNullIfNotFound) {
      return null;
    }

    try {
      return JSON.parse(body.toString());
    } catch (err) {
      throw new Error(`Failed to parse JSON data for key ${key}: ${err.message}`);
    }
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

  async existsBlob(key) {
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    try {
      logger.trace(`Checking for object existence at: s3://${this.bucketName}/${s3Key}`);
      await this.s3.headObject(params).promise();
      logger.trace(`Object exists: s3://${this.bucketName}/${s3Key}`);
      return true;
    } catch (err) {
      if (err.code === 'NotFound') {
        logger.trace(`Object does not exist: s3://${this.bucketName}/${s3Key}`);
        return false;
      }
      logger.error(`Error checking if object exists: s3://${this.bucketName}/${s3Key}`, err);
      throw err;
    }
  }

  async exists(key) {
    key = ensureJsonExtension(key);
    return await this.existsBlob(key);
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
