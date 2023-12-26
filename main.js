const AWS = require('aws-sdk');

class S3DB {
  constructor(bucketName, prefix = '') {
    this.bucketName = bucketName;
    this.prefix = prefix;

    // Create an S3 instance
    this.s3 = new AWS.S3();
  }

  async put(key, data) {
    const s3Key = this.prefix + key;
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
      Body: JSON.stringify(data),
    };

    await this.s3.upload(params).promise();
    //console.log(`Object uploaded: s3://${this.bucketName}/${s3Key}`);
  }

  async get(key, options = {}) {
    const s3Key = this.prefix + key;
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

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
    const s3Key = this.prefix + key;
    const params = {
      Bucket: this.bucketName,
      Key: s3Key,
    };

    await this.s3.deleteObject(params).promise();
    //console.log(`Object deleted: s3://${this.bucketName}/${s3Key}`);
  }

  async update(key, newData) {
    const s3Key = this.prefix + key;
    const existingData = await this.get(key);
    const updatedData = { ...existingData, ...newData };

    await this.put(key, updatedData);
    //console.log(`Object updated: s3://${this.bucketName}/${s3Key}`);
  }

  async list(subPath = '') {
    // if a subPath is provided, join that with the already set prefix
    let fullPrefix = this.prefix;
    if (subPath) {
      if (!this.prefix.endsWith('/') && !subPath.startsWith('/')) {
        fullPrefix += '/';
      }
      fullPrefix += subPath;
    }
    const params = {
      Bucket: this.bucketName,
      Prefix: fullPrefix,
    };

    const allKeys = [];
    let isTruncated = true;
    while (isTruncated) {
      const data = await this.s3.listObjects(params).promise();
      allKeys.push(...data.Contents.map((obj) => obj.Key.replace(fullPath, '')));
      isTruncated = data.IsTruncated;
      if (isTruncated) {
        params.Marker = data.Contents[data.Contents.length - 1].Key;
      }
    }

    return allKeys;
  }}

module.exports = S3DB;
