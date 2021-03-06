/**
 * Author  : Ramesh R
 * Created : 7/13/2015 6:12 PM
 * ----------------------------------------------------------------------
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE', which is part of this source code package.
 * ----------------------------------------------------------------------
 */

var utils = require(__dirname + '/utils'),
    vr = require(__dirname + '/vr'),
    dataReader = require(__dirname + '/datareader'),
    constants = require(__dirname + '/constants'),
    dataElementsDict = require(__dirname + '/dict').dataElements;

var DataElement = function (txProps) {

    this.txProps = txProps;

    this.id = null;
    this.tag = null;
    this.vr = null;
    this.valueLength = null;
    this.value = null;
};

DataElement.prototype.parse = function (buffer, position, options) {
    var currentPosition = position;
    var parsingDone = false;

    this.id = this.tag = utils.readTag(buffer, currentPosition, this.txProps.isBigEndian);

    /// Moving forward "constants.tagLength" bytes
    currentPosition += constants.tagLength;

    /// Check for Tag delimiters
    if (constants.delimiterTags.indexOf(this.id) > -1) {
        this.vr = null;
        this.valueLength = utils.readInteger(buffer, currentPosition, 4);
        currentPosition += 4;

        if (this.tag === constants.itemStartTag && options && options.searchSeqItem) {
            return currentPosition;
        }

        if (this.tag === constants.itemStartTag && this.valueLength > 0) {
            this.value = dataReader.read(buffer, currentPosition, this.valueLength, this.vr, this.txProps.isBigEndian);
            currentPosition += this.valueLength;
        }

        return currentPosition;
    }

    if (this.txProps.isImplicit) {
        var elementInfo = dataElementsDict[this.tag];

        if (elementInfo) {
            this.vr = elementInfo.vr;
        } else if (this.tag.substring(4, 8) === '0000') {
            this.vr = 'UL';
        } else {
            this.vr = 'UN';
        }

        this.valueLength = utils.readInteger(buffer, currentPosition, 4, this.txProps.isBigEndian);
        currentPosition += 4;
    } else { /// Explicit VRs
        this.vr = utils.readVr(buffer, currentPosition, constants.vrLength);

        /// for VRs of OB, OW, OF, SQ and UN the 16 bits following the two character VR Field are
        /// reserved for use by later versions of the DICOM Standard. These reserved bytes shall be set
        /// to 0000H and shall not be used or decoded (Table 7.1-1).
        /// for VRs of UT the 16 bits following the two character VR Field are reserved for use by later
        /// versions of the DICOM Standard. These reserved bytes shall be set to 0000H and shall not be
        /// used or decoded.
        /// for all other VRs the Value Length Field is the 16-bit unsigned integer following the two
        /// character VR Field (Table 7.1-2)
        /// ... So adding vrLength(2/4) instead of 2(constants.vrLength)
        var vrProps = vr.getLength(this.vr);
        currentPosition += constants.vrLength;
        currentPosition += vrProps.reserved;

        this.valueLength = utils.readInteger(buffer, currentPosition, vrProps.length, this.txProps.isBigEndian);

        currentPosition += vrProps.length;
    }

    if (this.vr == constants.sequenceVr) {
        this.sequenceItems = [];
        this.isSequence = true;

        parsingDone = true;

        var element = new DataElement(this.txProps);
        var currentPositionSeq = element.parse(buffer, currentPosition, {searchSeqItem: true});

        if (element.id == constants.sequenceDelimiterTag) {
            this.valueLength = currentPositionSeq - currentPosition;
        } else {
            var isImplicitVr = element.valueLength == 'FFFFFFFF'; // itemStart.valueLength == FFFFFFFF
            if (isImplicitVr) {
                var items = {};
                element = new DataElement(this.txProps);
                currentPositionSeq = element.parse(buffer, currentPositionSeq, {searchSeqItem: true});

                while (element.id != constants.sequenceDelimiterTag) { /// Sequence delimiter
                    if (element.id == constants.itemDelimiterTag) {
                        this.sequenceItems.push(items);
                        items = {};
                    } else {
                        items[element.id] = element;
                    }

                    element = new DataElement(this.txProps);
                    currentPositionSeq = element.parse(buffer, currentPositionSeq, {searchSeqItem: true});
                }

                this.valueLength = currentPositionSeq - currentPosition;
            } else {
                /// No sequence delimters
                /// TODO: Need to separate elements to their own item
                var items = {};
                while (currentPositionSeq < currentPosition + constants.tagLength) {
                    var element = new DataElement(this.txProps);

                    currentPositionSeq = element.parse(buffer, currentPositionSeq);
                    items[element.id] = element;
                }

                this.sequenceItems.push(items);
            }
        }
    }

    /// Pixel Data in OB
    if (this.vr == 'OB' && this.valueLength <= 0) {
        this.isPixelData = true;

        parsingDone = true;
        var element = new DataElement(this.txProps);
        var currentPositionSeq = element.parse(buffer, currentPosition, {searchSeqItem: true});

        this.pixelDataItems = [];
        if (element.id == constants.itemStartTag) {

            while (element.id != constants.sequenceDelimiterTag) {
                this.pixelDataItems.push(element);

                element = new DataElement(this.txProps);
                currentPositionSeq = element.parse(buffer, currentPositionSeq);
            }

            this.valueLength = currentPositionSeq - currentPosition;
        }
    }

    if (this.valueLength <= 0) {
        this.value = null;
        return currentPosition;
    }

    if (!parsingDone) {
        this.value = dataReader.read(buffer, currentPosition, this.valueLength, this.vr, this.txProps.isBigEndian);
    }

    currentPosition += this.valueLength;

    return currentPosition;
};

module.exports = DataElement;