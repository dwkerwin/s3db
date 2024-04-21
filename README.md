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
```

## Create Testing Infrastructure

This is to create the testin S3 bucket necessary to run unit tests.  Requires the AWS CLI and active AWS credentials to be configured in the environment.

```shell
aws cloudformation create-stack --stack-name S3DBUnitTestStack --template-body file://cloudformation.yml
```

## Test

```shell
npm test
```

## Publish to NPM

```shell
# depends on ~/.npmrc

# update version number in package.json and then ...
npm publish --access public
```
