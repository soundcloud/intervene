
`intervene` requires at least [node 12](https://nodejs.org), and is tested on all stable versions of node (currently 12, 14 and 15).

For older versions of node (8, 10), use intervene 2.x

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
