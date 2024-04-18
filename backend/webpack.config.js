const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  entry: ["./dist/server.js"],
  output: {
    filename: "backend.js",
  },
  target: "node",
  optimization: {
    minimize: true,
    mangleWasmImports: true,
    minimizer: [new TerserPlugin()],
    concatenateModules: true,
    mangleExports: "size",
    moduleIds: "size",
    removeAvailableModules: true,
  },
  mode: "production",
};
