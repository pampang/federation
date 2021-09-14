这是一个用 lerna 管理的项目，所以需要用 lerna 来初始化。

# 初始化
```bash
lerna bootstrap
yarn watch

// 在每个 leran package 中执行 yarn link
lerna exec --parallel yarn link

// cd 到目标项目，然后执行 yarn link
yarn link @apollo/gateway
yarn link @apollo/federation
```

# 配置文件
通过 npm link 来链接的文件，称为 symbolic link。
这并不是真实的链接。
在 node 中，我们可以通过添加 --preserve-symlinks 的参数，来控制文件的路径保留在当前目录下，而不是软连接的目录下。

```
{ --preserve-symlinks
  "runtimeArgs": ["--preserve-symlinks"]
}
```

配置了之后，原本在 `federation/**/*.js` 变为了 `node_modules/@apollo/gateway/**/*.js`。


在 vscode 的文档中：
https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_source-maps

我们看到 outFiles 一项。它是用来控制 debugger 的 sourcemap 范围的。
By default, only source maps in your outFiles will be resolved.

它的默认值应该是：
```
"outFiles": [
    "${workspaceFolder}/**/*.js",
    "!**/node_modules/**"
  ]
```

换句话说，node_modules 下的文件，他是默认不做 sourcemap 处理的。

我们可以改一改，让他解析 node_modules 下的 sourcemap，以符合预期：
```
"outFiles": [
  "${workspaceFolder}/**/*.js",
  // "${workspaceFolder}/../federation/**"
  "**/node_modules/@apollo/**"
],
```

但至于为什么不能解析 workspaceFolder 之外的文件，我就不知道了。

# node 中的 --preserve-symlinks
这是将软链接的文件，控制在本地，而不是在源目录下。
这样的好处是什么？能够共用同一套 node_modules context，避免报错。如 graphql 就不允许有两个实例，所以必须使用同一个 node_modules。


# 感想
通过官方文档，快速掌握最小必要知识，才能帮助你针对性解决问题。google 搜索出来的结果，大多都是一知半解，并不能帮助你解决问题，反而会把你带进死胡同。