const AWS = require('aws-sdk');
const logger = require('./logger');

class S3DB {
  constructor(bucketName, prefix = '') {
    this.bucketName = bucketName;
    this.prefix = prefix;

    // Create an S3 instance
    this.s3 = new AWS.S3();
  }

  async put(key, data, options = {}) {
    key = ensureJsonExtension(key);
    let body=null;
    if (options.formatForReadability) {
      body = JSON.stringify(data, null, 2);
    } else {
      body = JSON.stringify(data);
    }
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
      Body: body,
    };

    logger.trace(`S3DB: Uploading object: s3://${this.bucketName}/${s3Key}`);
    await this.s3.upload(params).promise();
  }

  async get(key, options = {}) {
    key = ensureJsonExtension(key);
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };
    logger.trace(`S3DB: Retrieving object: s3://${this.bucketName}/${s3Key}`)

    try {
        const data = await this.s3.getObject(params).promise();
        return JSON.parse(data.Body.toString());
    }
    catch (err) {
        if (options.returnNullIfNotFound && err.code === 'NoSuchKey') {
            return null;
        }
        throw err;
    }
  }

  async delete(key) {
    key = ensureJsonExtension(key);
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    logger.trace(`S3DB Deleting object: s3://${this.bucketName}/${s3Key}`);
    await this.s3.deleteObject(params).promise();
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
      const data = await this.s3.listObjects(params).promise();
      allKeys.push(...data.Contents.map((obj) => obj.Key.replace(fullPrefix + '/', '').replace('.json', '')));
      isTruncated = data.IsTruncated;
      if (isTruncated) {
        params.Marker = data.Contents[data.Contents.length - 1].Key;
      }
      logger.trace(`S3DB: Iteration ${iteration}, retrieved ${data.Contents.length} keys from: s3://${this.bucketName}/${fullPrefix}`);
    }

    logger.trace(`S3DB: Total ${allKeys.length} keys retrieved from: s3://${this.bucketName}/${fullPrefix}`);
    return allKeys;
  }

  async exists(key) {
    key = ensureJsonExtension(key);
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

}

// Helper function to join path parts
// This function will join the parts with a '/' and remove any extra '/'
// It will also remove the trailing '/' if the path is not the root path
// e.g. joinPath('a', 'b', 'c') => 'a/b/c'
// e.g. joinPath('a/', '/b', 'c/') => 'a/b/c'
function joinPath(...parts) {
  let path = parts.join('/').replace(/\/+/g, '/');
  if (path.endsWith('/') && path.length > 1) {
    path = path.slice(0, -1);
  }
  return path;
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
