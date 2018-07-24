const path = require('path');
const mode = process.env.NODE_ENV || 'development';
const minimize = mode === 'production';
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode,
  devtool: 'source-map',
  entry: {
    main: [
      path.resolve(__dirname, 'index.js')
    ],
    'pdf.worker': [
      path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.entry')
    ]
  },
  optimization: {
    minimize,
  },
  plugins: [
    new CopyWebpackPlugin([
      'logo.svg'
    ])
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  }
};
