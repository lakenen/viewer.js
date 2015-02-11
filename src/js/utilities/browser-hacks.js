/**
 * @fileoverview Browser-specific hacks
 * @author lakenen
 */

Crocodoc.addUtility('browser-hacks', function (framework) {

    'use strict';

    var browser = framework.getUtility('browser'),
        support = framework.getUtility('support'),
        subpx = framework.getUtility('subpx');

    return {
        getPageScaleCSS: function (scale) {
            var percent = 100 / scale;

            // apply css transform or zoom to autoscale layer (eg., text, links, user content)
            if (support.csstransform) {
                return support.csstransform + ':scale(' + scale + ');' +
                    'width:' + percent + '%;' +
                    'height:' + percent + '%;';
            } else if (support.csszoom) {
                return 'zoom:' + scale;
            }

            // this shouldn't happen... TODO: throw something?
            return '';
        },

        getPageLoadRange: function (numPages) {
            var range = (browser.mobile || browser.ielt10) ?
                MAX_PAGE_LOAD_RANGE_MOBILE :
                MAX_PAGE_LOAD_RANGE;
            return Math.min(range, numPages);
        },

        getEmbedStrategy: function () {
            // * IE 9-10 and firefox perform better with <img> elements
            // * IE 11 crashes when using img elements for some reason
            // * Everything else is happy with iframe + innerhtml
            return (browser.ielt11 || browser.firefox) ?
                EMBED_STRATEGY_DATA_URL_IMG :
                EMBED_STRATEGY_IFRAME_INNERHTML;
        },

        getDataURL: function (content, mimeType) {
            var dataURLPrefix = 'data:' + mimeType;
            if (!browser.ie && window.btoa) {
                return dataURLPrefix + ';base64,' + window.btoa(content);
            }
            return dataURLPrefix + ',' + encodeURIComponent(content);
        },

        getScrollEndTimeout: function () {
            return browser.mobile ? 500 : 250;
        },

        shouldRemoveImgOnUnload: function () {
            return browser.mobile;
        },

        shouldRemoveSvgOnUnload: function () {
            return browser.mobile || browser.ielt10;
        },

        shouldUseEventDelegationForPageLinks: function () {
            return !browser.ie;
        },

        shouldUseTextLayer: function () {
            return !browser.ielt9;
        },

        shouldUsePngFallback: function () {
            return !support.svg;
        },

        shouldEnableLinks: function () {
            return !browser.ielt9;
        },

        shouldUseTextRenderingGeometricPrecision: function () {
            // If using Firefox with no subpx support, add "text-rendering" CSS.
            // @NOTE(plai): We are not adding this to Chrome because Chrome supports "textLength"
            // on tspans and because the "text-rendering" property slows Chrome down significantly.
            // In Firefox, we're waiting on this bug: https://bugzilla.mozilla.org/show_bug.cgi?id=890692
            // @TODO: Use feature detection instead (textLength)
            return browser.firefox && !subpx.isSubpxSupported();
        },

        shouldNamespaceFonts: function () {
            return browser.ie;
        },

        shouldFixUseElements: function () {
            // @NOTE: there is a bug in Safari 6 where <use>
            // elements don't work properly
            return (browser.ios || browser.safari) && browser.version < 7;
        }
    };
});
