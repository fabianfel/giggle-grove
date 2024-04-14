const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  entry: ["./dist/server.js"],
  output: {
    filename: "backend.js",
  },
  target: "node",
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
};
