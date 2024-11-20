import * as chai from 'chai';
const expect = chai.expect;
import S3DB from './index.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Replace these constants with your test bucket and region
const TEST_BUCKET = 's3dbunittestbucket';
const REGION = 'us-east-1';

// Initialize AWS S3 client
const s3Client = new S3Client({ region: REGION });

// Helper function to clear the bucket
async function clearBucket(bucket) {
  const listParams = {
    Bucket: bucket
  };

  const response = await s3Client.send(new ListObjectsV2Command(listParams));
  if (!response.Contents || response.Contents.length === 0) return;

  const deleteParams = {
    Bucket: bucket,
    Delete: { Objects: [] }
  };

  response.Contents.forEach(({ Key }) => {
    deleteParams.Delete.Objects.push({ Key });
  });

  await s3Client.send(new DeleteObjectsCommand(deleteParams));

  if (response.IsTruncated) await clearBucket(bucket);
}

describe('S3DB Integration Tests', function() {
  this.timeout(10000);

  const s3db = new S3DB(TEST_BUCKET, 'users');
  const alternateS3db = new S3DB(TEST_BUCKET, 'alternate-users');

  const userId = 'U12345';
  const userData = { name: 'John Doe', email: 'john.doe@example.com' };

  before(async function() {
    this.timeout(5000); // Set timeout for before hook to 5 seconds

    // Clear the bucket before starting tests
    await clearBucket(TEST_BUCKET);

    // Create test files in the S3 bucket
    await s3Client.send(new PutObjectCommand({ Bucket: TEST_BUCKET, Key: 'users/U12345', Body: JSON.stringify(userData) }));
    await s3Client.send(new PutObjectCommand({ Bucket: TEST_BUCKET, Key: 'users/subpath/U12346', Body: JSON.stringify(userData) }));
    await s3Client.send(new PutObjectCommand({ Bucket: TEST_BUCKET, Key: 'users/subpath/subsubpath/U12347', Body: JSON.stringify(userData) }));
    await s3Client.send(new PutObjectCommand({ Bucket: TEST_BUCKET, Key: 'alternate-users/U54321', Body: JSON.stringify(userData) }));
    await s3Client.send(new PutObjectCommand({ Bucket: TEST_BUCKET, Key: 'alternate-users/subpath/U54322', Body: JSON.stringify(userData) }));
  });

  after(async function() {
    this.timeout(5000); // Set timeout for after hook to 5 seconds
    // Clear the bucket before starting tests
    await clearBucket(TEST_BUCKET);
  });

  it('should create an object', async function() {
    await s3db.put(userId, userData);
    const retrievedData = await s3db.get(userId);
    expect(retrievedData).to.deep.equal(userData);
  });

  it('should return null and not throw an exception when getting a non-existent object', async function() {
    const nonExistentData = await s3db.get('nonexistent', { returnNullIfNotFound: true });
    expect(nonExistentData).to.be.null;
  });

  it('should return null and not throw an exception when getting a non-existent raw object', async function() {
    const nonExistentRaw = await s3db.getRaw('nonexistent', { returnNullIfNotFound: true });
    expect(nonExistentRaw).to.be.null;
  });

  it('should throw an exception when getting a non-existent object without returnNullIfNotFound option', async function() {
    try {
      await s3db.get('nonexistent');
      // If the line above doesn't throw an exception, fail the test
      expect.fail('Expected an exception, but none was thrown');
    } catch (err) {
      // If an exception is thrown, pass the test
      expect(err).to.exist;
    }
  });

  it('should update the object with new properties while preserving existing properties', async function() {
    const updatedUserData = { newProperty: 'test123' };
    await s3db.update(userId, updatedUserData);
    const retrievedData = await s3db.get(userId);
    const expectedData = { ...userData, ...updatedUserData };
    expect(retrievedData).to.deep.equal(expectedData);
  });

  it('should replace the object with a new object', async function() {
    const updatedUserData = { name: 'Jane Doe', email: 'jane.doe@example.com' };
    await s3db.put(userId, updatedUserData);
    const retrievedData = await s3db.get(userId);
    expect(retrievedData).to.deep.equal(updatedUserData);
  });

  it('should confirm that the object exists', async function() {
    const doesExist = await s3db.exists(userId);
    expect(doesExist).to.be.true;
  });

  it('should create an object with a subpath provided', async function() {
    const moreUserData = { name: 'Jake Doe', email: 'jake.doe@example.com' };
    await s3db.put('subpath/U12346', moreUserData);
    const retrievedData = await s3db.get('subpath/U12346');
    expect(retrievedData).to.deep.equal(moreUserData);
  });

  it('should list the object', async function() {
    const allUserKeys = await s3db.list();
    expect(allUserKeys).to.include('U12345');
    expect(allUserKeys).to.include('subpath/U12346');
  });

  it('should include sub-paths and sub-sub-paths', async function() {
    const allUserKeys = await s3db.list();
    expect(allUserKeys).to.include('U12345');
    expect(allUserKeys).to.include('subpath/U12346');
    expect(allUserKeys).to.include('subpath/subsubpath/U12347');
  });

  it('should delete the object', async function() {
    await s3db.delete('U12345');
    await s3db.delete('subpath/U12346');

    // Directly verify that the objects do not exist anymore using the AWS S3 SDK
    try {
      await s3Client.send(new GetObjectCommand({ Bucket: TEST_BUCKET, Key: 'users/U12345.json' }));
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.name).to.equal('NoSuchKey');
    }

    try {
      await s3Client.send(new GetObjectCommand({ Bucket: TEST_BUCKET, Key: 'users/subpath/U12346.json' }));
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.name).to.equal('NoSuchKey');
    }
  });

  it('should retrieve the correct string data', async function() {
    const stringKey = 'S12345';
    const stringData = 'Hello, world!';
    const bufferData = Buffer.from(stringData, 'utf-8');
    await s3db.putRaw(stringKey, bufferData);
    const retrievedData = await s3db.getString(stringKey, { encoding: 'utf-8' });
    expect(retrievedData).to.equal(stringData);
    await s3db.deleteRaw(stringKey);
  });

  it('should create a raw object', async function() {
    const rawKey = 'B12345';
    const rawData = Buffer.from('Hello, world!', 'utf-8');
    await s3db.putRaw(rawKey, rawData);
    const retrievedData = await s3db.getRaw(rawKey);
    expect(retrievedData.toString('utf-8')).to.equal('Hello, world!');
  });

  it('should check if the raw object exists', async function() {
    const rawKey = 'B12345';
    const rawData = Buffer.from('Hello, world!', 'utf-8');
    await s3db.putRaw(rawKey, rawData);
    const doesExist = await s3db.existsRaw(rawKey);
    expect(doesExist).to.be.true;
    await s3db.deleteRaw(rawKey);
  });

  it('should delete the raw object', async function() {
    const rawKey = 'B12345';
    await s3db.deleteRaw(rawKey);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds to ensure S3 propagation
    const doesExist = await s3db.existsRaw(rawKey);
    expect(doesExist).to.be.false;
  });

  // Test for copy method with setup
  it('should copy an object to a new path', async function() {
    // Setup: Ensure the object exists before copying
    await s3db.put(userId, userData);
    
    const copyTarget = 'copy/U12345';
    await s3db.copy(userId, copyTarget);
    const copiedData = await s3db.get(copyTarget);
    expect(copiedData).to.deep.equal(userData);
    
    // Cleanup
    await s3db.delete(copyTarget);
  });

  // Test for copyFullyQualified method with setup
  it('should copy an object to a new path using fully qualified paths', async function() {
    // Setup: Ensure the object exists before copying
    await s3db.put(userId, userData);
    
    const sourcePath = `users/${userId}.json`;
    const destinationPath = `users/copyFullyQualified/U12345.json`;
    await s3db.copyFullyQualified(sourcePath, destinationPath);
    const copiedData = await s3db.get('copyFullyQualified/U12345');
    expect(copiedData).to.deep.equal(userData);
    
    // Cleanup
    await s3db.delete(destinationPath);
  });

  // Test for move method with setup
  it('should move an object to a new path', async function() {
    // Setup: Ensure the object exists before moving
    await s3db.put(userId, userData);
    
    const moveTarget = 'move/U12345';
    await s3db.move(userId, moveTarget);
    const movedData = await s3db.get(moveTarget);
    expect(movedData).to.deep.equal(userData);
    const originalExists = await s3db.exists(userId);
    expect(originalExists).to.be.false;
    
    // Cleanup
    await s3db.delete(moveTarget);
  });

  // Test for moveFullyQualified method with setup
  it('should move an object to a new path using fully qualified paths', async function() {
    // Setup: Ensure the object exists before moving
    await s3db.put(userId, userData);
    
    const sourcePath = `users/${userId}.json`;
    const destinationPath = `users/moveFullyQualified/U12345.json`;
    await s3db.moveFullyQualified(sourcePath, destinationPath);
    const movedData = await s3db.get('moveFullyQualified/U12345');
    expect(movedData).to.deep.equal(userData);
    const originalExists = await s3db.exists(userId);
    expect(originalExists).to.be.false;
    
    // Cleanup
    await s3db.delete(destinationPath);
  });

  // Additional tests for alternate S3DB instance
  it('should create and list objects under alternate path', async function() {
    const alternateUserId = 'U54321';
    const alternateUserData = { name: 'Alice Doe', email: 'alice.doe@example.com' };

    await alternateS3db.put(alternateUserId, alternateUserData);
    const retrievedData = await alternateS3db.get(alternateUserId);
    expect(retrievedData).to.deep.equal(alternateUserData);

    const allUserKeys = await alternateS3db.list();
    expect(allUserKeys).to.include(alternateUserId);
    expect(allUserKeys).to.include('subpath/U54322');
  });

  it('should delete the object under alternate path', async function() {
    await alternateS3db.delete('U54321');
    await alternateS3db.delete('subpath/U54322');

    // Directly verify that the objects do not exist anymore using the AWS S3 SDK
    try {
      await s3Client.send(new GetObjectCommand({ Bucket: TEST_BUCKET, Key: 'alternate-users/U54321.json' }));
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.name).to.equal('NoSuchKey');
    }

    try {
      await s3Client.send(new GetObjectCommand({ Bucket: TEST_BUCKET, Key: 'alternate-users/subpath/U54322.json' }));
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.name).to.equal('NoSuchKey');
    }
  });

  it('should list objects correctly after creation and deletion', async function() {
    // // Ensure the bucket is empty initially
    // const initialKeys = await s3db.list();
    // expect(initialKeys).to.be.empty;
  
    // Add objects
    await s3db.put('listTest/U1', userData);
    await s3db.put('listTest/subpath/U2', userData);
    await s3db.put('listTest/subpath/subsubpath/U3', userData);
  
    // List objects and verify they are present
    let allUserKeys = await s3db.list('listTest');
    expect(allUserKeys).to.include('U1');
    expect(allUserKeys).to.include('subpath/U2');
    expect(allUserKeys).to.include('subpath/subsubpath/U3');
  
    // Delete objects
    await s3db.delete('listTest/U1');
    await s3db.delete('listTest/subpath/U2');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds to ensure S3 propagation
  
    // Verify the objects are deleted
    try {
      await s3Client.send(new GetObjectCommand({ Bucket: TEST_BUCKET, Key: 'users/listTest/U1.json' }));
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.name).to.equal('NoSuchKey');
    }
  
    try {
      await s3Client.send(new GetObjectCommand({ Bucket: TEST_BUCKET, Key: 'users/listTest/subpath/U2.json' }));
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.name).to.equal('NoSuchKey');
    }
  
    // List objects again and verify only the remaining object is listed
    allUserKeys = await s3db.list('listTest');
    expect(allUserKeys).to.not.include('U1');
    expect(allUserKeys).to.not.include('subpath/U2');
    expect(allUserKeys).to.include('subpath/subsubpath/U3');
  
    // Clean up remaining object
    await s3db.delete('listTest/subpath/subsubpath/U3');
  });

  it('should not return results from a similarly named but different path', async function() {
    // Define the exact prefix S3DB instance for this test
    const exactPrefixS3db = new S3DB(TEST_BUCKET, 'testdata/doesnotexist/');
  
    // Create a test object in a similar but different path
    await s3Client.send(new PutObjectCommand({ Bucket: TEST_BUCKET, Key: 'testdata/doesnotexist_doesexist/12345', Body: JSON.stringify(userData) }));
  
    // List objects with the non-existent prefix
    const userIds = await exactPrefixS3db.list();
  
    // Ensure the list is empty
    expect(userIds).to.be.empty;
  
    // Clean up the test object
    await s3Client.send(new DeleteObjectCommand({ Bucket: TEST_BUCKET, Key: 'testdata/doesnotexist_doesexist/12345' }));
  });

  it('should create an encrypted object with KMS key', async function() {
    const encryptedS3db = new S3DB(TEST_BUCKET, 'encrypted-users', 'alias/s3db-unittest-key');
    await encryptedS3db.put(userId, userData);
    const retrievedData = await encryptedS3db.get(userId);
    expect(retrievedData).to.deep.equal(userData);
    await encryptedS3db.delete(userId);
  });

  it('should create an encrypted raw object with KMS key', async function() {
    const encryptedS3db = new S3DB(TEST_BUCKET, 'encrypted-users', 'alias/s3db-unittest-key');
    const rawKey = 'B12345';
    const rawData = Buffer.from('Hello, world!', 'utf-8');
    await encryptedS3db.putRaw(rawKey, rawData);
    const retrievedData = await encryptedS3db.getRaw(rawKey);
    expect(retrievedData.toString('utf-8')).to.equal('Hello, world!');
    await encryptedS3db.deleteRaw(rawKey);
  });

  it('should create and read back an encrypted object with KMS key', async function() {
    const encryptedS3db = new S3DB(TEST_BUCKET, 'encrypted-users', 'alias/s3db-unittest-key');
    const testUserId = 'encrypted-user-123';
    const testUserData = { name: 'Alice Encrypted', email: 'alice.encrypted@example.com' };
    
    // Write the encrypted data
    await encryptedS3db.put(testUserId, testUserData);
    
    // Create a new S3DB instance with the same KMS key to verify reading works with a fresh instance
    const readEncryptedS3db = new S3DB(TEST_BUCKET, 'encrypted-users', 'alias/s3db-unittest-key');
    const retrievedData = await readEncryptedS3db.get(testUserId);
    
    expect(retrievedData).to.deep.equal(testUserData);
    await encryptedS3db.delete(testUserId);
  });

  it('should create and read back an encrypted raw object with KMS key', async function() {
    const encryptedS3db = new S3DB(TEST_BUCKET, 'encrypted-users', 'alias/s3db-unittest-key');
    const rawKey = 'encrypted-raw-123';
    const rawData = Buffer.from('Secret encrypted data!', 'utf-8');
    
    // Write the encrypted data
    await encryptedS3db.putRaw(rawKey, rawData);
    
    // Create a new S3DB instance with the same KMS key to verify reading works with a fresh instance
    const readEncryptedS3db = new S3DB(TEST_BUCKET, 'encrypted-users', 'alias/s3db-unittest-key');
    const retrievedData = await readEncryptedS3db.getRaw(rawKey);
    
    expect(retrievedData.toString('utf-8')).to.equal('Secret encrypted data!');
    await encryptedS3db.deleteRaw(rawKey);
  });

});
