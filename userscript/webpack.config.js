const path = require('path');

module.exports = {
	entry: './dist/index.js',
	output: {
		filename: 'script.js',
		path: path.resolve(__dirname, 'dist'),
	},
	mode: 'production',
	optimization: {
		minimize: false,
	},
};
