/**
 * @fileoverview A standard data provider for stylesheet.css
 * @author lakenen
 */
Crocodoc.addDataProvider('stylesheet', function(scope) {
    'use strict';

    var ajax = scope.getUtility('ajax'),
        hacks = scope.getUtility('browser-hacks'),
        config = scope.getConfig(),
        $cachedPromise;

    var FONT_FAMILY_REGEXP = /font-family:[\s\"\']*([\w-]+)\b/g;

    /**
     * Process stylesheet text and return the embeddable result
     * @param   {string} text The original CSS text
     * @returns {string}      The processed CSS text
     * @private
     */
    function processStylesheetContent(text) {
        // @NOTE: There is a bug in IE that causes the text layer to
        // not render the font when loaded for a second time (i.e.,
        // destroy and recreate a viewer for the same document), so
        // namespace the font-family so there is no collision
        if (hacks.shouldNamespaceFonts()) {
            text = text.replace(FONT_FAMILY_REGEXP, '$0-' + config.id);
        }

        return text;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {
        /**
         * Retrieve the stylesheet.css asset from the server
         * @returns {$.Promise} A promise with an additional abort() method that will abort the XHR request.
         */
        get: function() {
            if ($cachedPromise) {
                return $cachedPromise;
            }

            var $promise = ajax.fetch(this.getURL(), Crocodoc.ASSET_REQUEST_RETRIES);

            // @NOTE: promise.then() creates a new promise, which does not copy
            // custom properties, so we need to create a futher promise and add
            // an object with the abort method as the new target
            $cachedPromise = $promise.then(processStylesheetContent).promise({
                abort: function () {
                    $promise.abort();
                    $cachedPromise = null;
                }
            });
            return $cachedPromise;
        },

        /**
         * Build and return the URL to the stylesheet CSS
         * @returns {string}         The URL
         */
        getURL: function () {
            var cssPath = config.template.css;
            return config.url + cssPath + config.queryString;
        },

        /**
         * Cleanup the data-provider
         * @returns {void}
         */
        destroy: function () {
            ajax = hacks = config = null;
            $cachedPromise = null;
        }
    };
});
