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

    await this.s3.upload(params).promise();
    logger.trace(`Object uploaded: s3://${this.bucketName}/${s3Key}`);
  }

  async get(key, options = {}) {
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    try {
        const data = await this.s3.getObject(params).promise();
        logger.trace(`Object retrieved: s3://${this.bucketName}/${s3Key}`)
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
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    await this.s3.deleteObject(params).promise();
    logger.trace(`Object deleted: s3://${this.bucketName}/${s3Key}`);
  }

  async update(key, newData) {
    const s3Key = joinPath(this.prefix, key);
    const existingData = await this.get(s3Key);
    const updatedData = { ...existingData, ...newData };

    await this.put(key, updatedData);
    logger.trace(`Object updated: s3://${this.bucketName}/${s3Key}`);
  }

  async list(subPath = '') {
    // if a subPath is provided, join that with the already set prefix
    let fullPrefix = this.prefix;
    if (subPath) {
      fullPrefix = joinPath(this.prefix, subPath);
    }
    const params = {
      Bucket: this.bucketName,
      Prefix: fullPrefix,
    };

    const allKeys = [];
    let isTruncated = true;
    while (isTruncated) {
      const data = await this.s3.listObjects(params).promise();
      allKeys.push(...data.Contents.map((obj) => obj.Key.replace(fullPrefix, '')));
      isTruncated = data.IsTruncated;
      if (isTruncated) {
        params.Marker = data.Contents[data.Contents.length - 1].Key;
      }
    }

    logger.trace(`Returning list of ${allKeys.length} keys retrieved from: s3://${this.bucketName}/${fullPrefix}`);
    return allKeys;
  }

  async exists(key) {
    const s3Key = joinPath(this.prefix, key);
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    try {
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

function joinPath(...parts) {
  return parts.join('/').replace(/\/+/g, '/');
}

module.exports = S3DB;
