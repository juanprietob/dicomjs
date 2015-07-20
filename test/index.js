/**
 * Author  : Ramesh R
 * Created : 7/16/2015 11:58 PM
 * ----------------------------------------------------------------------
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE', which is part of this source code package.
 * ----------------------------------------------------------------------
 */

var dicomjs = require('../index'),
    assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
//sampleDcmPath = 'samples/CR-MONO1-10-chest'
//sampleDcmPath = 'samples/DISCIMG/IMAGES/CRIMAGEA'
//    sampleDcmPath = 'samples/DISCIMG/IMAGES/DXIMAGEA'
//    sampleDcmPath = 'samples/big/000000000005A3D8'
sampleDcmPath = 'samples/big/I0010001'
//sampleDcmPath = 'samples/CT-MONO2-16-ort' /// Implicit VR
    ;

fs.readFile(path.join(__dirname, sampleDcmPath), function (err, buffer) {
    console.time('Process_Time');
    dicomjs.parse(buffer, function (err, dcmData) {
        //console.log(err);
        console.timeEnd('Process_Time');
        console.time('Process_Time2');

        console.log('Process complete');
        if (!err) {
            console.log('Meta Elements..');
            for (var key in dcmData.metaElements) {
                console.log('   tag: ', key, ', value: ', dcmData.metaElements[key].value);
            }

            console.log('Standard elements..');
            for (var key in dcmData.dataset) {
                console.log('   tag: ', key, ', value: ', dcmData.dataset[key].value);
            }

            console.log('Parsing complete..');
        }

        console.timeEnd('Process_Time2');
        assert.ok(err == null, 'Parsed Results');
    });
});