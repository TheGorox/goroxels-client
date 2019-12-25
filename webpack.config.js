const fs = require('fs-extra');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/*const ExtractTextPlugin = require('extract-text-webpack-plugin');*/

const srcDir = path.resolve(__dirname, 'src');

const config = {
    entry: {
        app: path.resolve(srcDir, 'js', 'main.js')
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/'
    },
    devServer: {
        contentBase: false,
        compress: true,
        historyApiFallback: true,
        open: false
    },
    module: {
        rules: [{
            include: path.resolve(srcDir, 'js'),
            use: [{
                loader: 'babel-loader',
                query: {
                    "presets": ["@babel/preset-env"]
                }
            }]
        }, {
            include: path.resolve(srcDir, 'img'),
            use: [{
                loader: 'file-loader',
                options: {
                    outputPath: 'img/',
                    name: '[name].[ext]'
                }
            }]
        }, {
            include: path.resolve(srcDir, 'audio'),
            use: [{
                loader: 'file-loader',
                options: {
                    outputPath: 'audio/',
                    name: '[name].[ext]'
                }
            }]
        }, {
            include: path.resolve(srcDir, 'font'),
            use: [{
                loader: 'file-loader',
                options: {
                    outputPath: 'font/',
                    name: '[name].[ext]'
                }
            }]
        }, {
            include: path.resolve(srcDir, 'css'),
            use: ['style-loader', 'css-loader'],
        }]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(srcDir, 'index.html'),
            
            //favicon: path.resolve(srcDir, 'favicon.ico')
        })
    ]
};

module.exports = async env => {
    env = env || {};
    console.log(env)
    if (!env.release) {
        config.mode = "development";
        config.devtool = "source-map";
        config.output.publicPath = '/';
    } else {
        config.mode = "production";
        config.output.filename = '[name].[hash].js';
        console.log(`Cleaning build dir: '${config.output.path}'`);
        await fs.remove(config.output.path);
    }

    config.plugins.push(new webpack.DefinePlugin({
        'PRODUCTION_BUILD': JSON.stringify(!!env.release)
    }));

    return config;
};