# S3DB

S3DB provides a database like interface for the Amazon S3 object storage service. The motivation behind S3DB is cost effectiveness. By leveraging S3 as a datastore, you can significantly reduce costs compared to using a database like Amazon DynamoDB. However, it's important to note that S3DB is not a drop in replacement for a database. Underneath the interface, it's still S3, and it comes with the limitations inherent to an object storage service. This means that while S3DB provides a database like interface for storing and retrieving data, it should still be treated as S3. If your application can work within these limitations, S3DB offers a cost effective way to manage your data with an interface that is similar to a database, but at a fraction of the cost.

## Installation

Via npm:
```shell
npm install --save @dwkerwin/s3db
```

## Usage

AWS credentials are acquired from environment variables.

```javascript
const S3DB = require('@dwkerwin/s3db');

// Create a new instance of S3DB
const s3db = new S3DB('myuserdatabucket', 'users');

// Put an item
const newUserData = { name: 'John Doe', email: 'john.doe@example.com' };
const userId = 'U12345';
await s3db.put(userId, newUserData);
// this will store newUserData at s3://myuserdatabucket/users/U12345.json
// note that the following statement is equivalent:
// await s3db.put('U12345.json', newUserData);

// Get an item
const userData = await s3db.get(userId);
// this will retrieve an object stored at s3://myuserdatabucket/users/U12345.json
console.log(`User name: ${userData.name} (${user.email})`);

// By default, `get` throws an exception if the object isn't found
// However, you can use the `returnNullIfNotFound` option to return null instead
const missingRecord = await s3db.get('thiswillnotexist', { returnNullIfNotFound: true });
if (missingRecord === null) {
    console.log('Object does not exist');
}

// Replace an item
const updatedUserData = { name: 'Jane Doe', email: 'jane.doe@example.com' };
await s3db.put(userId, updatedUserData);
// this will update the object at s3://myuserdatabucket/users/U12345.json with updatedUserData

// Update an item with an additional propery, preserving existing properties
await s3db.update(userId, { address: '123 Main St.' });

// List items
const allUserKeys = await s3db.list();
// this will return a list of all items in s3://myuserdatabucket/users/,
// including items in subdirectories, e.g.: ['U12345']
for (const userKey of allUserKeys) {
    const user = s3db.get(userKey);
    console.log(`Found user: ${user.name} (${user.email})`);
}

// Delete an item
await s3db.delete(userId);
// this will delete the file at s3://myuserdatabucket/users/U12345.json
// note that the following statement is equivalent:
// s3db.delete('U12345.json');

// Copy an item within the same bucket
await s3db.copy('U12345', 'archive/U12345');
// This will copy the object from s3://myuserdatabucket/users/U12345.json to s3://myuserdatabucket/users/archive/U12345.json

// Copy an item to a different path using fully qualified paths
await s3db.copyFullyQualified('myuserdatabucket/users/U12345.json', 'myuserdatabucket/archive/U12345.json');
// Note that here we're not subject to the same prefix since we're using fully
// qualified paths

// Move an item within the same bucket
await s3db.move('U12345', 'old_users/U12345');
// This will move the object from s3://myuserdatabucket/users/U12345.json to s3://myuserdatabucket/users/old_users/U12345.json

// Move an item to a different path using fully qualified paths
await s3db.moveFullyQualified('myuserdatabucket/users/U12345.json', 'myuserdatabucket/old_users/U12345.json');
// Note that here we're not subject to the same prefix since we're using fully
// qualified paths
```

## Server-Side Encryption with KMS

S3DB supports server-side encryption using AWS KMS keys. You can specify either a KMS key ID or a KMS alias when creating an S3DB instance:

```javascript
// Create an S3DB instance with KMS encryption (using either key ID or alias)
const s3db = new S3DB('myuserdatabucket', 'users', '1234abcd-12ab-34cd-56ef-1234567890ab'); // Using key ID
// OR
const s3db = new S3DB('myuserdatabucket', 'users', 'alias/my-kms-key'); // Using alias

// Write and read data - encryption is handled automatically
const userData = { name: 'John Doe', email: 'john@example.com' };
await s3db.put('user123', userData);
const retrieved = await s3db.get('user123');
```

## Working with Blobs

In addition to the standard methods for working with JSON objects, S3DB also provides methods for working with blobs of any type. These methods are:

- `putRaw(key, data)`: Stores a blob of data at the specified key.
- `getRaw(key)`: Retrieves the blob of data stored at the specified key.
- `deleteRaw(key)`: Deletes the blob of data stored at the specified key.
- `existsRaw(key)`: Checks if a blob of data exists at the specified key.

These methods work in the same way as their counterparts for JSON objects, but they do not assume any specific data type or extension. This makes them suitable for working with any type of data, not just JSON.

Here's an example of how to use these methods:

```javascript
const blobKey = 'B12345';
const blobData = Buffer.from('Anything could go here, an image, a binary file, etc.', 'utf-8');

// Store the blob data
await s3db.putRaw(blobKey, blobData);

// Retrieve the blob data
const retrievedData = await s3db.getRaw(blobKey);
console.log(retrievedData.toString('utf-8'));

// Check if the blob data exists
const doesExist = await s3db.existsRaw(blobKey);
console.log(doesExist); // Outputs: true

// Delete the blob data
await s3db.deleteRaw(blobKey);
```

## Create Testing Infrastructure

This is to create the testin S3 bucket necessary to run unit tests.  Requires the AWS CLI and active AWS credentials to be configured in the environment.

```shell
aws cloudformation create-stack --stack-name S3DBUnitTestStack --template-body file://cloudformation.yml
```

## Test

```shell
export AWS_PROFILE="your AWS profile here"
npm test
```

## Publish to NPM

```shell
# depends on ~/.npmrc

# update version number in package.json and then ...
npm publish --access public
```
