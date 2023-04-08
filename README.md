# S3DB

DB like interface for S3 datastore

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

```javascript
const S3DB = require('@bestselfapp/s3db');

const s3db = new S3DB('mybucketname', 'myprefix/');
const userData = await s3db.get('myuserid.json');
```
