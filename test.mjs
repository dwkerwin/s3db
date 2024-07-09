import * as chai from 'chai';
const expect = chai.expect;
import S3DB from './index.js';
import AWS from 'aws-sdk';

// Replace these constants with your test bucket and region
const TEST_BUCKET = 's3dbunittestbucket';
const REGION = 'us-east-1';

// Initialize AWS S3 client
const s3 = new AWS.S3({ region: REGION });

// Helper function to clear the bucket
async function clearBucket(bucket) {
  const listParams = {
    Bucket: bucket
  };

  const listedObjects = await s3.listObjectsV2(listParams).promise();

  if (listedObjects.Contents.length === 0) return;

  const deleteParams = {
    Bucket: bucket,
    Delete: { Objects: [] }
  };

  listedObjects.Contents.forEach(({ Key }) => {
    deleteParams.Delete.Objects.push({ Key });
  });

  await s3.deleteObjects(deleteParams).promise();

  if (listedObjects.IsTruncated) await clearBucket(bucket);
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
    await s3.putObject({ Bucket: TEST_BUCKET, Key: 'users/U12345', Body: JSON.stringify(userData) }).promise();
    await s3.putObject({ Bucket: TEST_BUCKET, Key: 'users/subpath/U12346', Body: JSON.stringify(userData) }).promise();
    await s3.putObject({ Bucket: TEST_BUCKET, Key: 'users/subpath/subsubpath/U12347', Body: JSON.stringify(userData) }).promise();
    await s3.putObject({ Bucket: TEST_BUCKET, Key: 'alternate-users/U54321', Body: JSON.stringify(userData) }).promise();
    await s3.putObject({ Bucket: TEST_BUCKET, Key: 'alternate-users/subpath/U54322', Body: JSON.stringify(userData) }).promise();
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

  it('should return null and not throw an exception when getting a non-existent blob', async function() {
    const nonExistentBlob = await s3db.getBlob('nonexistent', { returnNullIfNotFound: true });
    expect(nonExistentBlob).to.be.null;
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
      await s3.getObject({ Bucket: TEST_BUCKET, Key: 'users/U12345.json' }).promise();
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.code).to.equal('NoSuchKey');
    }

    try {
      await s3.getObject({ Bucket: TEST_BUCKET, Key: 'users/subpath/U12346.json' }).promise();
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.code).to.equal('NoSuchKey');
    }
  });

  it('should retrieve the correct string data', async function() {
    const stringKey = 'S12345';
    const stringData = 'Hello, world!';
    const bufferData = Buffer.from(stringData, 'utf-8');
    await s3db.putBlob(stringKey, bufferData);
    const retrievedData = await s3db.getString(stringKey, { encoding: 'utf-8' });
    expect(retrievedData).to.equal(stringData);
    await s3db.deleteBlob(stringKey);
  });

  it('should create a blob object', async function() {
    const blobKey = 'B12345';
    const blobData = Buffer.from('Hello, world!', 'utf-8');
    await s3db.putBlob(blobKey, blobData);
    const retrievedData = await s3db.getBlob(blobKey);
    expect(retrievedData.toString('utf-8')).to.equal('Hello, world!');
  });

  it('should check if the blob object exists', async function() {
    const blobKey = 'B12345';
    const blobData = Buffer.from('Hello, world!', 'utf-8');
    await s3db.putBlob(blobKey, blobData);
    const doesExist = await s3db.existsBlob(blobKey);
    expect(doesExist).to.be.true;
    await s3db.deleteBlob(blobKey);
  });

  it('should delete the blob object', async function() {
    const blobKey = 'B12345';
    await s3db.deleteBlob(blobKey);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for 3 seconds to ensure S3 propagation
    const doesExist = await s3db.existsBlob(blobKey);
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
      await s3.getObject({ Bucket: TEST_BUCKET, Key: 'alternate-users/U54321.json' }).promise();
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.code).to.equal('NoSuchKey');
    }

    try {
      await s3.getObject({ Bucket: TEST_BUCKET, Key: 'alternate-users/subpath/U54322.json' }).promise();
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.code).to.equal('NoSuchKey');
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
      await s3.getObject({ Bucket: TEST_BUCKET, Key: 'users/listTest/U1.json' }).promise();
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.code).to.equal('NoSuchKey');
    }
  
    try {
      await s3.getObject({ Bucket: TEST_BUCKET, Key: 'users/listTest/subpath/U2.json' }).promise();
      expect.fail('Expected an error, but none was thrown'); // Fail if no error is thrown
    } catch (err) {
      expect(err.code).to.equal('NoSuchKey');
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
    await s3.putObject({ Bucket: TEST_BUCKET, Key: 'testdata/doesnotexist_doesexist/12345', Body: JSON.stringify(userData) }).promise();
  
    // List objects with the non-existent prefix
    const userIds = await exactPrefixS3db.list();
  
    // Ensure the list is empty
    expect(userIds).to.be.empty;
  
    // Clean up the test object
    await s3.deleteObject({ Bucket: TEST_BUCKET, Key: 'testdata/doesnotexist_doesexist/12345' }).promise();
  });

});
