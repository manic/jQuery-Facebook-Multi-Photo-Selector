/**
 * jQuery Facebook Multi-Photo Selector (jfmps)
 * https://github.com/seanhellwig/jQuery-Facebook-Multi-Photo-Selector
 * Allows the selection of Facebook album photos
 * @author Sean Hellwig
 * Inspired by: https://github.com/mbrevoort/jquery-facebook-multi-friend-selector - thanks for some css :)
 * @dependencies jQuery 1.4.4+ http://jquery.com/
 * License: MIT
**/

// Thanks Paul Irish - http://paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log=function(){log.history=log.history||[];log.history.push(arguments);if(this.console){console.log(Array.prototype.slice.call(arguments));}};


(function($){
	var JFMPS = function(element, options){
		var container = $(element),
			domStructure = container.append($('<div id="jfmps-inner-header">' +
				'<div id="jfmps-breadcrumb">' +
					'<span id="jfmps-default-crumb">相簿</span>' +
					'<span id="jfmps-crumb-separator">&raquo;</span>' +
					'<span id="jfmps-photos-list-crumb"></span>' +
				'</div>' +
				'<a class="jfmps-meta" id="jfmps-num-selected" href="javascript:void(0);">已選擇(<span id="jfmps-selected-count">0</span>)</a>' +
				'<a class="jfmps-meta" id="jfmps-clear-button" href="javascript:void(0);">清除已選相片</a>' +
				'<a class="jfmps-meta" id="jfmps-photo-next-page" data-mtype="photo" href="javascript:void(0);">下一頁</a>' +
				'<a class="jfmps-meta" id="jfmps-photo-prev-page" data-mtype="photo" href="javascript:void(0);">上一頁</a>' +
				'<a class="jfmps-meta" id="jfmps-album-next-page" data-mtype="album" href="javascript:void(0);">下一頁</a>' +
				'<a class="jfmps-meta" id="jfmps-album-prev-page" data-mtype="album" href="javascript:void(0);">上一頁</a>' +
			'</div>' +
			'<div id="jfmps-album-covers"></div>' +
			'<div id="jfmps-album-photos"></div>' +
			'<div id="jfmps-selected-container">' +
				'<h3>已選相片</h3>' +
				'<div id="jfmps-selected-photos"></div>' +
			'</div>')),
			albumContainer = $('#jfmps-album-covers', container),
			albumPhotosContainer = $('#jfmps-album-photos', container),
			selectedPhotosContainer = $('#jfmps-selected-photos', container),
			countSelector = $('#jfmps-selected-count', container),
			breadcrumbEl = $('#jfmps-photos-list-crumb', container),
			breadcrumbSeparator = $('#jfmps-crumb-separator', container),
			imageClearButton = $('#jfmps-clear-button', container),
			nextPage = $('#jfmps-photo-next-page', container),
			prevPage = $('#jfmps-photo-prev-page', container),
            albumNextPage = $('#jfmps-album-next-page', container),
            albumPrevPage = $('#jfmps-album-prev-page', container),
			breadCrumbTpl = '{album_name} [X]',
			settings = {
                photosLimit : 25,
				maxPhotosSelected : 10,
				numAlbumColumns : 4,
				numPhotosColumns: 6,
				imageSubmitButton : $('#jfmps-submit-button'),
				submitCallback : function(jsonData){ alert(jsonData); },
				noAlbumImagesText : "沒有相片",
				noAlbumsText : "沒有相簿",
				selectedImageCallback: null,
				debug: false
			},
			albumImageCache,
			selectedPhotos,
			selectedPhotosCount = 0;
		settings = $.extend(true, settings, options || {});

		/**
		 * Main entry point. Queries Facebook Graph API for a list of user albums, executes callback on completion.
		*/
		var _init = function(){
			if (settings.numAlbumColumns < 1 || settings.numPhotosColumns < 1) {
				if (settings.debug) {log('settings.numAlbumColumns & settings.numPhotosColumns must be greater than 0');}
				return;
			}

			_updateSelectedCountDisplay();

			FB.api('/me/albums', _showAlbumContent);
            albumNextPage.bind('click', _getPage);
            albumPrevPage.bind('click', _getPage);
            nextPage.bind('click', _getPage).hide();
            prevPage.bind('click', _getPage).hide();
		};

		/**
		 * Parses raw Facebook Graph API album data, adds images to the DOM, sets up initial storage objects and event handlers.
		 * @param response Facebook Response Object
		*/
		var _showAlbumContent = function(response){
			if (settings.debug) {log('FB API Response /me/albums:', response);}

			if (response.data && response.data.length > 0) {
				var albums = response.data,
					i;

				albumImageCache = {};
				selectedPhotos = {};

				breadcrumbEl.hide();
				breadcrumbSeparator.hide();
				albumPhotosContainer.hide();

				settings.imageSubmitButton.bind('click', _submitSelectedImages);
				imageClearButton.bind('click', _clearSelectedImages);
                nextPage.data('type', 'album').data('url', response.paging.next);
                prevPage.data('type', 'album').data('url', response.paging.previous);

				for (i = 0; i < albums.length; i++) {
					var newRow = (i + 1) % settings.numAlbumColumns === 1 || settings.numAlbumColumns === 1 ? true : false;
					if (newRow) {
					 albumContainer.append('<div class="image-row" />');
					}
					_appendAlbum(albums[i]);
				};
			}else{
				var content = "<h2>" + settings.noAlbumsText + "</h2>";
		        container.append(content);
			}
		};

		/**
		 * Helper method for _showAlbumContent. Creates the DOM structure for an Album image, adds click listener, and appends it to the container.
		 * @param album Object
		**/
		var _appendAlbum = function(album){
			var albumEl = $('<div id="fb-albumcover-' + album.id + '" class="jfmps-albumcover" />');
			albumEl.data('album_id', album.id);

			var albumName = $('<div class="jfmps-albumname" />').text(album.name);
			var albumCoverImage = $('<img width="50" src="https://graph.facebook.com/' + album.id  + '/picture?access_token=' + FB.getAuthResponse().accessToken + '&amp;type=thumbnail" />');

			albumEl.append(albumCoverImage);

			albumEl.append(albumName);

			albumEl.bind('click', function(e){
				_handleAlbumClickListeners(e, albumEl, album.name);
			});

			$('div.image-row', albumContainer).last().append(albumEl);
		};

		/**
		 * Click Event Handler for Albums. Queries Facebook Graph API for Album images, adds it to cache. Updates breadcrumb album name.
		 * @param e Event Object.
		 * @param albumEl jQuery Element - Album container.
		 * @param albumName String of the Album Name
		**/
		var _handleAlbumClickListeners = function(e, albumEl, albumName){
			var albumId = albumEl.data('album_id'), nowPage = 1;
			breadcrumbEl.empty().html(breadCrumbTpl.replace('{album_name}', albumName));

            albumPrevPage.hide();
            albumNextPage.hide();
			if (albumImageCache[albumId] === undefined) {
				FB.api('/' + albumId + '/photos', function(response){
					if (settings.debug) {log('FB API Response /' + albumId + '/photos:', response);}

                    albumImageCache[albumId] = {};
					albumImageCache[albumId][nowPage] = response;
                    _checkPage(albumId, nowPage);
					_showAlbumImages(albumId, nowPage);
				});
			}else{
                _checkPage(albumId, nowPage);
				_showAlbumImages(albumId, nowPage);
			}
		};

		/**
		 * Helper method for _handleAlbumClickListeners.
		 * Constructs DOM elements from cached Facebook Graph API Image Object. Adds Click Event Listener to breadcrumb bar.
		 * @param int Facebook Graph Object ID of Album.
		**/
		var _showAlbumImages = function(albumId, nowPage){
			var albumImagesData = albumImageCache[albumId][nowPage].data,
				i;
			albumPhotosContainer.empty();
            if (albumImagesData.length > 0) {
    			for (i = 0; i < albumImagesData.length; i++) {
					var newRow = (i + 1) % settings.numPhotosColumns === 1 ? true : false;
					if (newRow) {
					 albumPhotosContainer.append('<div class="image-row" />');
					}
    				var imageContainer = $('<div id="fb-albumimage-' + albumImagesData[i].id + '" class="jfmps-albumimage" />');
    				imageContainer.data('image_id', albumImagesData[i].id);

    				if (selectedPhotos[albumImagesData[i].id] !== undefined){
    					imageContainer.addClass('selected');
    				}

    				var albumImage = $('<img width="75" src="https://graph.facebook.com/' + albumImagesData[i].id  + '/picture?access_token=' + FB.getAuthResponse().accessToken + '&amp;type=thumbnail" />');

    				imageContainer.append(albumImage);

    				$('div.image-row', albumPhotosContainer).last().append(imageContainer);


    				_makeImageSelectable(imageContainer, albumImagesData[i].images);
    			};
		    }else{
		        var content = "<h2>" + settings.noAlbumImagesText + "</h2>";
		        albumPhotosContainer.append(content);
		    }
			breadcrumbEl.bind('click', _showAlbumList).show();
			breadcrumbSeparator.show();
			albumContainer.hide();
			albumPhotosContainer.show();
		};

		/**
		 * Adds Click event listener to Album images.  Adds or removes an Album Image from the selectedItems list.
		 * @param imageContainer jQuery Element - container the selected Image.
		 * @param imageData Object of Facebook Graph API image node.
		**/
		var _makeImageSelectable = function(imageContainer, imageData){
			var imageId = imageContainer.data('image_id');

			imageContainer.bind('click', function(e){
				if (selectedPhotos[imageId] === undefined) {
					if (selectedPhotosCount < settings.maxPhotosSelected) {
						selectedPhotos[imageId] = imageData;
						imageContainer.addClass('selected');

						_addToSelectedList(imageContainer);

						selectedPhotosCount += 1;
						_updateSelectedCountDisplay();

						settings.selectedImageCallback !== null ? settings.selectedImageCallback() : null;
					}
				}else{
					imageContainer.removeClass('selected');
					delete selectedPhotos[imageId];

					_removeFromSelectedList(imageContainer);
				}

				_updateActionButtons();
			});
		};

		/**
		 * Helper method for _makeImageSelectable. Adds Image to right column selected image list.
		 * @param selectedImage jQuery Element - Image container.
		**/
		var _addToSelectedList = function(selectedImage){
			var imageEl = $('img', selectedImage),
				imageId = selectedImage.data('image_id'),
				newImageItem = $('<li id="selected-' + imageId + '"/>'),
				imageList;

			if ($('ul', selectedPhotosContainer).length <= 0){
				imageList = $('<ul/>');
				selectedPhotosContainer.append(imageList);
			}else{
				imageList = $('ul', selectedPhotosContainer);
			}

			imageEl.clone().appendTo(newImageItem);

			imageList.append(newImageItem);

			_makeUnselectable(newImageItem);
		};

		/**
		 * Makes a selected image unselectable by addinga hover state and icon to unselect
		 * @param listItem the <li> element that is to be made capable of unselecting
		 **/
		var _makeUnselectable = function(listItem){
			var unselectEl = $('<span class="jfmps-selected-unselect"/>').html('[x] 移除');

			unselectEl.hide();

			listItem.css('position', 'relative');
			unselectEl.bind('click', function(e){
				e.preventDefault();
				e.stopPropagation();

				var imageId = listItem.attr('id').split('selected-')[1];
				if (settings.debug) { log('deleted: ' + imageId); }
				$('#fb-albumimage-' + imageId).removeClass('selected');

				delete selectedPhotos[imageId];

				listItem.remove();

				selectedPhotosCount -= 1;
				_updateSelectedCountDisplay();

			});
			listItem.bind('mouseenter', function(e){
				unselectEl.show();
			});
			listItem.bind('mouseleave', function(e){
				unselectEl.hide();
			});

			listItem.append(unselectEl);

		};

		/**
		 * Helper method for  _makeImageSelectable. Removes Image from right column selected image list.
		 * @param selectedImage jQuery Element - Image container.
		**/
		var _removeFromSelectedList = function(selectedImage){
			var imageId = selectedImage.data('image_id'),
				imageList = $('ul', selectedPhotosContainer).eq(0);

				$('li#selected-' + imageId, imageList).remove();

				selectedPhotosCount -= 1;

				_updateSelectedCountDisplay();
		};

		/**
		 * Empties Album Image container and hides it.  Hides breadcrumb bar. Shows Albums.
		**/
		var _showAlbumList = function(){
			albumPhotosContainer.empty().hide();
			breadcrumbEl.unbind('click').hide();
			breadcrumbSeparator.hide();
			albumContainer.show();
            albumPrevPage.show();
            albumNextPage.show();
            prevPage.hide();
            nextPage.hide();

		};

		/**
		 * Creates JSON String of selectedPhotos Object
		 * @return JSON String of keys - imageId, values 3 different size images.
		**/
		var _getSelectedImagesData = function(){
			if (selectedPhotosCount > 0) {
				return JSON.stringify(selectedPhotos);
			}else{
				return false;
			}
		};

		/**
		 * Send JSON String of selectedPhotos Object to callback function.
		 * @param Event Object
		**/
		var _submitSelectedImages = function(e){
			if (selectedPhotosCount > 0) {
				var outputJson = _getSelectedImagesData();

				if (settings.debug) {log(outputJson);}

				if (settings.submitCallback) {
					settings.submitCallback(outputJson);
				};
			};
		};

		/**
		 * Removed images from selectedPhotos Object and the selected images list. Toggles selected class on Image Container DOM elements.
		**/
		var _clearSelectedImages = function(){
			for (var k in selectedPhotos){
				if (selectedPhotos.hasOwnProperty(k)) {

					delete selectedPhotos[k];

					$('#fb-albumimage-' + k, container).removeClass('selected');
					$('li#selected-' + k, container).remove();

				};
			}

			selectedPhotosCount = 0;

			_updateSelectedCountDisplay();

			imageClearButton.hide();
		};


		/**
		 * Toggles display state clear and submit button
		**/
		var _updateActionButtons = function(){
			if (selectedPhotosCount > 0) {
				settings.imageSubmitButton.show();
				imageClearButton.show();
			}else{
				settings.imageSubmitButton.hide();
				imageClearButton.hide();
			}
		};

		/**
		 * Updates the DOM element to show the current num of selected photos
		**/
		var _updateSelectedCountDisplay = function(){
			countSelector.html(selectedPhotosCount + ' / ' + settings.maxPhotosSelected);

			_updateActionButtons();
		};

        var _gup = function(name, href) {
            name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
            var regexS = "[\\?&]"+name+"=([^&#]*)";
            var regex = new RegExp( regexS );
            var results = regex.exec( href );
            if( results == null )
                return "";
            else
                return results[1];
        };

        var _getPage = function() {
            if ($(this).data('mtype') == 'album') {
                console.log($(this).data('url'));
                FB.api($(this).data('url'), _showAlbumContent);
            } else {
                var nowPage = $(this).data('page'),
                    albumId = $(this).data('albumId'),
                    url = '/' + albumId + '/photos?offset=' + (25 * (nowPage - 1));

                if (albumImageCache[albumId][nowPage] === undefined) {
                    FB.api(url, function(response){
                        if (settings.debug) {log('FB API Response /' + albumId + '/photos/' + nowPage + ':', response);}

                        albumImageCache[albumId][nowPage] = response;
                        _checkPage(albumId, nowPage);
                        _showAlbumImages(albumId, nowPage);
                    });
                }else{
                    _checkPage(albumId, nowPage);
                    _showAlbumImages(albumId, nowPage);
                }
            }
        };

        var _checkPage = function(albumId, nowPage) {
            var response = albumImageCache[albumId][nowPage];
            if (response.paging && response.paging.next) {
                nextPage.data('page', nowPage + 1).data('url', response.paging.next).show();
            } else {
                nextPage.hide();
            }

            if (response.paging && response.paging.previous) {
                prevPage.data('page', nowPage - 1).data('url', response.paging.previous).show();
            } else {
                prevPage.hide();
            }
            nextPage.data('albumId', albumId);
            prevPage.data('albumId', albumId);
        };

		/**
		 * Begin app
		**/
		_init();

		/**
		 * Public API
		*/
		return {
			clearSelectedImages: function(){
				return _clearSelectedImages();
			},
			getSelectedImages: function(){
				return _getSelectedImagesData();
			}
		};
	};

	/**
	 * jQuery plugin format
	**/
	$.fn.jfmps = function(options){
		return this.each(function(){
			var el = $(this),
				jfmps;

			if (el.data('jfmps')) { return el.data('jfmps'); };

			jfmps = new JFMPS(this, options);

			el.data('jfmps', jfmps);

			return this;
		});
	};

})(jQuery);