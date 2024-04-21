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
});