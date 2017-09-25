//
// Copyright (C) 2017 University of Dundee & Open Microscopy Environment.
// All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
//
goog.provide('ome.ol3.controls.IntensityDisplay');

goog.require('ol');
goog.require('ol.events');
goog.require('ol.events.EventType');
goog.require('ol.control.Control');
goog.require('ol.css');


/**
 * @classdesc
 * A control for intensity display.
 * It handles the request on mouse move
 *
 * @constructor
 */
ome.ol3.controls.IntensityDisplay = function() {

    /**
     * maximum number of cached intensity values
     * @type {number}
     * @private
     */
    this.CACHE_LIMIT = 1000*1000;

    /**
     * a 2 level cache for intensity values
     * we don't let it grow too big so we
     * have a first level per z/t combination
     * to ensure that we delete z/t entries
     * other than the present one first once
     * we reach the maximum count allowed
     * the second layer is arranged in x-y
     * location entries with their respective
     * channel intensitiess
     * @type {Object}
     * @private
     */
    this.intensities_cache_ = {
        'count': 0,
        'intensities': {}
    }

    /**
     * a handle for the setTimeout routine
     * @type {number}
     * @private
     */
    this.movement_handle_ = null;

    /**
     * the last cursor position
     * @type {Array.<number>}
     * @private
     */
    this.last_cursor_ = [0,0];

    /**
     * a possible request prefix we need to include
     * @type {string}
     * @private
     */
    this.prefix_ = "";

    /**
     * the look of the intensity display
     * @type {string}
     * @private
     */
    this.style_ =
        "filter:alpha(opacity=55);-webkit-box-shadow:none;" +
        "box-shadow:none;opacity:.55;";

    /**
     * flag that controls whether we query the intensity or not
     * @type {boolean}
     * @private
     */
    this.query_intensity_ = false;

    /**
     * a reference to the Image instance
     * @type {ome.ol3.source.Image}
     * @private
     */
    this.image_ = null;

    /**
     * handle on the pointer move listener
     * @type {number}
     * @private
     */
    this.pointer_move_listener_ = null;

    // set up html
    var container =
        ome.ol3.controls.IntensityDisplay.prototype.createUiElements_.call(this);

    // call super
    ol.control.Control.call(this, {
        element: container
    });
};
ol.inherits(ome.ol3.controls.IntensityDisplay, ol.control.Control);

/**
 * Adds the UI elements to display the intensities and turn requests off
 * @private
 */
ome.ol3.controls.IntensityDisplay.prototype.createUiElements_ = function() {
    var cssClasses =
        'ol-intensity ' + ol.css.CLASS_UNSELECTABLE + ' ' +
            ol.css.CLASS_CONTROL;

    // main container
    var element = document.createElement('div');
    element.className = cssClasses;

    var button = document.createElement('button');
    button.className ="btn btn-default intensity-display-toggler";
    button.setAttribute('type', 'button');
    button.appendChild(document.createTextNode(""));
    button.style = this.style_;

    element.appendChild(button);

    return element;
};

/**
 * Makes control start listening to mouse movements and display coordinates
 * Does not mean that it we start requesting intensity values
 * see {@link toggleIntensityQuerying}
 * @param {string=} prefix the prefix for the intensity request
 */
ome.ol3.controls.IntensityDisplay.prototype.enable = function(prefix) {
    this.query_intensity_ = false;
    this.prefix_ = prefix || "";
    this.image_ = this.getMap().getLayers().item(0).getSource();
    this.pointer_move_listener_ =
        ol.events.listen(
            this.getMap(),
            ol.MapBrowserEventType.POINTERMOVE,
            ome.ol3.controls.IntensityDisplay.prototype.handlePointerMove_.bind(this));
}

/**
 * Stop listening to mouse movements (and querying intensities)
 */
ome.ol3.controls.IntensityDisplay.prototype.disable = function() {
    this.query_intensity_ = false;
    if (this.pointer_move_listener_) {
        ol.events.unlistenByKey(this.pointer_move_listener_);
        this.pointer_move_listener_ = null;
    }
    this.resetMoveTracking_();
    this.image_ = null;
    var el = this.getIntensityTogglerElement();
    if (el) el.innerHTML = "";
}

/**
 * Updates the Mouse Tooltip with either one of the following:
 * - hiding (if no querying/display)
 * - loading message (if querying)
 * - data display (after querying)
 * @private
 * @param {ol.MapBrowserEvent} event the pointe move event
 * @param {Array.<Object>} data the pixel intensity results
 * @param {boolean} is_querying if true we are querying and display a message
 */
ome.ol3.controls.IntensityDisplay.prototype.updateTooltip =
    function(event, data, is_querying) {
        if (typeof is_querying !== 'boolean') is_querying = false;
        var targetId =
            ome.ol3.utils.Misc.getTargetId(this.getMap().getTargetElement());
        var els = document.getElementById('' + targetId).querySelectorAll(
            '.ol-intensity-popup');
        var tooltip = els && els.length > 0 ? els[0] : null;
        var hasData = typeof data === 'object' && data !== null;
        var hideTooltip = event === null || (!is_querying && !hasData);
        if (hideTooltip) {
            if (tooltip) tooltip.style.display = "none";
            return;
        }

        var createTooltip = typeof tooltip === 'undefined' || tooltip === null;
        if (createTooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'ol-intensity-popup';
        }

        tooltip.style.position = 'absolute';
        // visibility hidden let's us measure the dims of the tooltip
        tooltip.style.display = '';
        tooltip.style.visibility = 'hidden';
        tooltip.innerHTML = "";
        if (hasData) {
            for (var x in data) {
                if (!this.image_.channels_info_[x]['active']) continue;
                var val = data[x];
                var label = this.image_.channels_info_[x]['label'];
                var r = document.createElement('div');
                r.innerHTML =
                    '<span>' + label + ':</span>' + '&nbsp;' + val.toFixed(3);
                tooltip.appendChild(r);
            }
        } else if (is_querying) {
            tooltip.innerHTML = "Querying Intensity...";
        }

        var coordinate = event.pixel.slice();
        try {
            var parent = event.originalEvent.target.parentNode;
            var w = tooltip.offsetWidth;
            var h = tooltip.offsetHeight;
            if (coordinate[0] + w > parent.offsetWidth) {
                var x = coordinate[0] - w;
                coordinate[0] = (x >= 0) ? x : 0;
            }
            if (coordinate[1] + h > parent.offsetHeight) {
                var y = coordinate[1] - h;
                coordinate[1] = (y >= 0) ? y : 0;
            }
        } catch (ignored) {}
        tooltip.style.left = "" + (coordinate[0]) + "px";
        tooltip.style.top = "" + (coordinate[1]) + "px";

        if (this.last_cursor_[0] === event.pixel[0] &&
            this.last_cursor_[1] === event.pixel[1]) {
            tooltip.style.visibility = "visible";
            if (createTooltip) {
                var target = this.getMap().getTargetElement();
                if (target) target.childNodes[0].appendChild(tooltip);
            }
        }
}

/**
 * Resets params for move 'tracking'
 * @param {Array.<number>} pixel the pixel coordinates to reset to
 * @private
 */
ome.ol3.controls.IntensityDisplay.prototype.resetMoveTracking_ = function(pixel) {
    this.last_cursor_ =
        ome.ol3.utils.Misc.isArray(pixel) && pixel.length === 2 ?
            pixel : [0,0];
    this.updateTooltip();
    if (typeof this.movement_handle_ === 'number') {
        clearTimeout(this.movement_handle_);
        this.movement_handle_ = null;
    }
}

/**
 * Returns the intensity toggler element
 * @return {Element|null} the intensity toggler element
 */
ome.ol3.controls.IntensityDisplay.prototype.getIntensityTogglerElement = function() {
    var targetId =
        ome.ol3.utils.Misc.getTargetId(this.getMap().getTargetElement());
    var els = document.getElementById('' + targetId).querySelectorAll(
            '.intensity-display-toggler');
    if (els && els.length > 0) return els[0];
    return null;
}

/**
 * Handles the pointer move
 * (display of coordinates and a potential triggering of the intensity request)
 * @private
 */
ome.ol3.controls.IntensityDisplay.prototype.handlePointerMove_ = function(e) {
    this.resetMoveTracking_(e.pixel);
    var isMainCanvas = false;
    try {
        var target =  e.originalEvent.target;
        var isCanvas = target.nodeName.toUpperCase() === 'CANVAS';
        if (isCanvas) {
            isMainCanvas =
                target.parentNode.parentNode.className.indexOf(
                    "ol-overviewmap") < 0;
        }
    } catch(ignored) {}
    // we ignore dragging actions and mouse over controls
    if (!isMainCanvas || e.dragging) return;

    var el = this.getIntensityTogglerElement();
    var x = e.coordinate[0], y = -e.coordinate[1];
    if (x < 0 || x >= this.image_.getWidth() ||
        y < 0 || y >= this.image_.getHeight()) {
            el.innerHTML = "";
            return;
        }
    el.innerHTML = x.toFixed(0) + "," + y.toFixed(0);

    if (this.query_intensity_) {
        var activeChannels = this.image_.getChannels();
        if (activeChannels.length === 0) return;

        x = parseInt(x);
        y = parseInt(y);
        var z = this.image_.getPlane();
        var t = this.image_.getTime();
        var displayIntensity = function(results) {
            el.innerHTML = x.toFixed(0) + "," + y.toFixed(0);
            this.updateTooltip(e, results);
        }.bind(this);

        var cache_entry = this.getCachedIntensities(z, t, x, y);
        var channelsThatNeedToBeRequested = []
        // could be that we need a channel that is missing
        // while others are there already...
        // request only the missing ones
        if (cache_entry !== null) {
            for (var c in activeChannels)
                if (typeof cache_entry[c] !== 'number')
                    channelsThatNeedToBeRequested.push(parseInt(c));
        } else channelsThatNeedToBeRequested = activeChannels;

        // best case scenario: we have a cached entry
        if (channelsThatNeedToBeRequested.length === 0) {
            displayIntensity(cache_entry);
            return;
        }

        // we have to request the intensities
        // for the z,t,c,x and y given
        var reqParams = {
            "server" : this.image_.server_,
            "uri" : /*this.prefix_ + */ "get_intensity/?image=" + this.image_.id_ +
                    "&z=" + z + "&t=" + t + "&x=" + x + "&y=" + y +
                    "&c=" + channelsThatNeedToBeRequested.join(','),
            "success" : function(resp) {
                try {
                    var res = JSON.parse(resp);
                    this.cacheIntensities(res);
                    displayIntensity(this.getCachedIntensities(z, t, x, y));
                } catch(parseError) {
                    console.error(parseError);
                }
            }.bind(this),
            "error" : function(err) {
                el.innerHTML = x.toFixed(0) + "," + y.toFixed(0);
                this.updateTooltip();
                console.error(err);
            }.bind(this)
        };

        this.movement_handle_ = setTimeout(
            function() {
                if (this.last_cursor_[0] === e.pixel[0] &&
                    this.last_cursor_[1] === e.pixel[1]) {
                        this.updateTooltip(e, null, true);
                        ome.ol3.utils.Net.sendRequest(reqParams);
                }
            }.bind(this), 500);
    }
}

/**
 * Looks up cached intensities using plane and time as well as location
 *
 * @param {number} plane
 * @param {number} time
 * @param {number} x
 * @param {number} y
 * @return {Object} an object with channels and their respective intensity
 */
ome.ol3.controls.IntensityDisplay.prototype.getCachedIntensities =
    function(plane, time, x, y) {
        if (this.intensities_cache_['count'] === 0) return null;
        try {
            var planeTimeEntry =
                this.intensities_cache_['intensities']["" + plane + "-" + time];
            if (typeof planeTimeEntry['pixels']["" + x + "-" + y] !== 'object')
                return null;
            return planeTimeEntry['pixels']["" + x + "-" + y];
        } catch(ex) {
            return null;
        }
}

ome.ol3.controls.IntensityDisplay.prototype.cacheIntensities =
    function(intensities) {
        try {
            var plane = this.image_.getPlane();
            var time = this.image_.getTime();
            var key = "" + plane + "-" + time;

            // check if we exceed cache limit
            // if so we remove cache entries
            // preferably for other plane/time
            if (this.intensities_cache_['count']  +
                    intensities['count'] > this.CACHE_LIMIT) {
                for (var tmp in this.intensities_cache_['intensities']) {
                    if (tmp !== key) {
                        this.intensities_cache_['count'] -=
                            this.intensities_cache_['intensities'][tmp]['count'];
                        delete this.intensities_cache_['intensities'][tmp];
                    }
                    if (this.intensities_cache_['count']  +
                            intensities['count'] < this.CACHE_LIMIT) break;
                }
                if (this.intensities_cache_['count']  +
                        intensities['count'] > this.CACHE_LIMIT) {
                    delete this.intensities_cache_['intensities'][key];
                    this.intensities_cache_['count'] = 0;
                }
            }

            if (typeof this.intensities_cache_['intensities'][key] !== 'object') {
                // set planeTimeEntry to be the new intensities queried
                this.intensities_cache_['intensities'][key] = intensities;
                this.intensities_cache_['count'] += intensities['count'];
            } else {
                // we have an existing planeTimeEntry with existing intensities
                // loop over the ones we queried and add them
                var planeTimeEntry = this.intensities_cache_['intensities'][key];
                for (var pixel in intensities['pixels']) {
                    if (typeof planeTimeEntry['pixels'][pixel] !== 'object')
                        planeTimeEntry['pixels'][pixel] = {}
                    // add intensity for queries channel (if not exists)
                    var pixelIntensities = intensities['pixels'][pixel];
                    for (var chan in pixelIntensities)
                        if (typeof planeTimeEntry['pixels'][pixel][chan] !== 'number') {
                            planeTimeEntry['pixels'][pixel][chan] = pixelIntensities[chan];
                            planeTimeEntry['count']++;
                            this.intensities_cache_['count']++;
                        }
                }
            }
        } catch(ex) {
            console.error("Failed to cache intensities: " + ex);
        }
}

/**
 * Enables/Disables intensity querying on pointerdrag
 * @param {boolean} flag if true enable intensity querying, otherwise disable it
 */
ome.ol3.controls.IntensityDisplay.prototype.toggleIntensityQuerying = function(flag) {
    // could be we have not been enabled before
    if (this.pointer_move_listener_ === null || this.image_ === null) {
        this.disable(); // just to make sure
        this.enable(this.prefix_);
    };

    if (typeof flag !== 'boolean') flag = false;
    if ((flag && this.query_intensity_) || // no change
        (!flag && !this.query_intensity_)) return this.query_intensity_;

    // change value
    return (this.query_intensity_ = flag);
}

/**
 * sort of destructor
 */
ome.ol3.controls.IntensityDisplay.prototype.disposeInternal = function() {
    this.disable();
};
