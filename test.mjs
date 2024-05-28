import * as chai from 'chai';
const expect = chai.expect;
import S3DB from './index.js';

describe('S3DB', function() {
  const s3db = new S3DB('s3dbunittestbucket', 'users');

  const userId = 'U12345';
  const userData = { name: 'John Doe', email: 'john.doe@example.com' };

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

  it('should delete the object', async function() {
    await s3db.delete('U12345');
    await s3db.delete('subpath/U12346');
    const allUserKeys = await s3db.list();
    expect(allUserKeys).to.not.include(userId);
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
    const doesExist = await s3db.existsBlob(blobKey);
    expect(doesExist).to.be.false;
  });

});