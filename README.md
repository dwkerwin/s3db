# S3DB

S3DB is a library that provides a database like interface for the Amazon S3 object storage service. The motivation behind S3DB is cost effectiveness. By leveraging S3 as a datastore, you can significantly reduce costs compared to using a traditional database like Amazon DynamoDB. However, it's important to note that S3DB is not a drop in replacement for a database. Underneath the interface, it's still S3, and it comes with the limitations inherent to an object storage service. This means that while S3DB provides a database like interface for storing and retrieving data, it should still be treated as S3. If your application can work within these limitations, S3DB offers a cost effective way to manage your data with an interface that is similar to a database, but at a fraction of the cost.

## Installation

The target project must have a `.npmrc` file with the following line in it:
```
@bestselfapp:registry=https://npm.pkg.github.com
```

Then it can be installed via:

```shell
npm install --save @bestselfapp/s3db
```

## Publish to Github Packages Private NPM Repo

To setup ~/.npmrc to add the authentication to publish to the private Github Packages npm repo, see:
https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry

```shell
# depends on ./.npmrc and ~/.npmrc

# update version number in package.json and then ...
npm publish
```

## Usage

AWS credentials are acquired from environment variables.

```javascript
const S3DB = require('@bestselfapp/s3db');

// Create a new instance of S3DB
const s3db = new S3DB('mybucketname', 'myprefix/');

// Get an item
const userData = await s3db.get('myuserid.json');
// this will retrieve a file stored at s3://mybucketname/myprefix/myuserid.json

// Put an item
const newUserData = { name: 'John Doe', email: 'john.doe@example.com' };
await s3db.put('newuserid.json', newUserData);
// this will store newUserData at s3://mybucketname/myprefix/newuserid.json

// Update an item
const updatedUserData = { name: 'Jane Doe', email: 'jane.doe@example.com' };
await s3db.update('myuserid.json', updatedUserData);
// this will update the file at s3://mybucketname/myprefix/myuserid.json with updatedUserData

// Delete an item
await s3db.delete('myuserid.json');
// this will delete the file at s3://mybucketname/myprefix/myuserid.json

// List items
const items = await s3db.list();
// this will return a list of all items in s3://mybucketname/myprefix/, including items in subdirectories
```
