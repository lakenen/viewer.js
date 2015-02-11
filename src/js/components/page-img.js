/**
 * @fileoverview page-img component
 * @author lakenen
 */

/**
 * page-img component used to display raster image instead of SVG content for
 * browsers that do not support SVG
 */
Crocodoc.addComponent('page-img', function (scope) {

    'use strict';

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    var hacks = scope.getUtility('browser-hacks');

    var $img, $el,
        $loadImgPromise,
        page,
        imageLoaded = false,
        removeOnUnload = hacks.shouldRemoveImgOnUnload();

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    return {
        /**
         * Initialize the page-img component
         * @param  {Element} el     The element to insert the image into
         * @param  {number} pageNum The page number
         * @returns {void}
         */
        init: function (el, pageNum) {
            $el = $(el);
            page = pageNum;
        },

        /**
         * Destroy the page-img component
         * @returns {void}
         */
        destroy: function () {
            removeOnUnload = true;
            this.unload();
            $el.empty();
        },

        /**
         * Prepare the element for loading
         * @returns {void}
         */
        prepare: function () { /* noop */ },

        /**
         * Preload the image
         * @returns {void}
         */
        preload: function () {
            if (!$loadImgPromise) {
                $loadImgPromise = scope.get('page-img', page);
            }
        },

        /**
         * Load the image
         * @returns {$.Promise}    A jQuery Promise object
         */
        load: function () {
            this.preload();

            $loadImgPromise.done(function loadImgSuccess(img) {
                if (!imageLoaded) {
                    imageLoaded = true;
                    $img = $(img).appendTo($el);
                }
                // always show the image
                $img.show();
            });

            $loadImgPromise.fail(function loadImgFail(error) {
                imageLoaded = false;
                if (error) {
                    scope.broadcast('asseterror', error);
                }
            });

            return $loadImgPromise;
        },

        /**
         * Unload (or hide) the img
         * @returns {void}
         */
        unload: function () {
            if ($loadImgPromise) {
                $loadImgPromise.abort();
                $loadImgPromise = null;
            }
            if (removeOnUnload) {
                if ($img) {
                    $img.remove();
                    $img = null;
                }
                imageLoaded = false;
            } else if ($img) {
                $img.hide();
            }
        }
    };
});
