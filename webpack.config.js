const fs = require('fs-extra');
const path = require('path');
const webpack = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');
// const JavaScriptObfuscator = require('webpack-obfuscator');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/*const ExtractTextPlugin = require('extract-text-webpack-plugin');*/

const srcDir = path.resolve(__dirname, 'src');

const config = {
    entry: {
        game: path.resolve(srcDir, 'js/main.js'),
        converters: path.resolve(srcDir, 'js/convert/main.js'),
        admin: path.resolve(srcDir, 'js/admin/main.js')
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '.'
    },
    module: {
        rules: [{
            include: path.resolve(srcDir, 'img'),
            use: [{
                loader: 'file-loader',
                options: {
                    outputPath: '/img/',
                    name: '[name].[ext]'
                }
            }]
        }, {
            include: path.resolve(srcDir, 'audio'),
            use: [{
                loader: 'file-loader',
                options: {
                    outputPath: '/audio/',
                    name: '[name].[ext]'
                }
            }]
        }, {
            include: path.resolve(srcDir, 'font'),
            use: [{
                loader: 'file-loader',
                options: {
                    outputPath: '/font/',
                    name: '[name].[ext]'
                }
            }]
        }, {
            test: /\.css/,
            use: [MiniCssExtractPlugin.loader, {
                loader: 'css-loader',
                options: {
                    modules: false,
                }
            }],
        }]
    },
    plugins: [
        new MiniCssExtractPlugin(),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: path.resolve(srcDir, 'html/index.html'),
            favicon: path.resolve(srcDir, 'favicon.ico'),
            chunks: ['game']
        }),
        new HtmlWebpackPlugin({
            filename: 'convert.html',
            template: path.resolve(srcDir, 'html/convert.html'),
            favicon: path.resolve(srcDir, 'favicon.ico'),
            chunks: ['converters']
        }),
        new HtmlWebpackPlugin({
            filename: 'admin.html',
            template: path.resolve(srcDir, 'html/admin.html'),
            favicon: path.resolve(srcDir, 'favicon.ico'),
            chunks: ['admin']
        }),
        new CircularDependencyPlugin(), // optional
        new webpack.ProvidePlugin({
            '$': 'jquery',
            'toastr': 'toastr'
        }),
        //new JavaScriptObfuscator()
    ]
};

module.exports = async env => {
    env = env || {};
    console.log('Release: ' + !!env.release);

    if (!env.release) {
        config.mode = "development";
        config.devtool = "source-map";
    } else {
        config.mode = "production";
        config.output.filename = '[name].[hash].js';
        config.devtool = false;
    }

    console.log(`Cleaning build dir: '${config.output.path}'`);
    await fs.remove(config.output.path);

    config.plugins.push(new webpack.DefinePlugin({
        'PRODUCTION_BUILD': JSON.stringify(!!env.release)
    }));

    return config;
};