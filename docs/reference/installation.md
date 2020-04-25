
`intervene` requires at least [node 8](https://nodejs.org), and is tested on all stable versions of node (currently 8, 10, 12 and 14).

As node 8 is now EOL, we may drop support for node 8 at some point in the future.

## Install globally

This will allow you to run `intervene` from anywhere

```shell
npm install -g intervene
```

Note that depending on your [node.js](https://nodejs.org) installation, you may need to `sudo`

```shell
sudo npm install -g intervene
```

## Install as a project `devDependency`

You can of course also install `intervene` as a `devDependency` of your project. You might want to do this if you want to keep common configurations checked in to your repository, as it ensures all developers are using the same version.

```shell
npm install --save-dev intervene
```
