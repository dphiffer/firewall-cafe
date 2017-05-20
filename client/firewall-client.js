var storage = chrome.storage.local;

var clientId = randomClientId();
var pendingQuery = {};
var query = null;

var ignoreSubmit = false;
var ignorePending = false;
var getImagesTimeout = null;
var autocompleteEnabled = true;

var $googleInput = $('#lst-ib');

var sleepTimeoutMinutes = 0.1;
var sleepTimeout;

function sleepReset() {
	if (sleepTimeout) {
		clearTimeout(sleepTimeout);
	}
	sleepTimeout = setTimeout(function() {
		chrome.runtime.sendMessage({
			type: 'sleep_start',
			enabled: false
		});
	}, sleepTimeoutMinutes * 60 * 1000);
}
sleepReset();

if (window.location.host == 'www.google.no') {
	// Google Norway => Plain Vanilla Google
	window.location = window.location.href.replace(/google.no/, 'google.com');
} else if (window.location.host == 'www.google.com' &&
    window.location.pathname == '/') {
	// Google homepage => Google image search homepage
	window.location = 'https://www.google.com/imghp';
}

$(document.body).mousemove(function() {
	sleepReset();
});

$(document.body).keypress(function() {
	sleepReset();
});

storage.get([
	'clientId',
	'pendingQuery',
	'autocompleteEnabled'
], function(stored) {

	// Get or set the client ID.
	if (stored.clientId) {
		clientId = stored.clientId;
	} else {
		storage.set({
			clientId: clientId
		});
	}

	console.log('Firewall Cafe | ' + clientId);
	console.log('Server: ' + config.serverURL);

	// Get user autocomplete preference.
	if (stored.autocompleteEnabled) {
		autocompleteEnabled = (stored.autocompleteEnabled == 'on');
	}

	if (autocompleteEnabled) {
		console.log('Autocomplete enabled.');
	} else {
		console.log('Autocomplete disabled.');
	}

	// Check for a pending query in storage and set it.
	if (stored.pendingQuery) {
		pendingQuery = stored.pendingQuery;
		if (pendingQuery.query) {
			console.log('Stored pending query: ' + pendingQuery.query);
		} else {
			console.log('No stored pending query. Starting fresh.');
		}
	} else {
		console.log('No stored pending query. Starting fresh.');
	}

	setupUI();
	setupIntroScreen();
	setupStorageListener();
	setupMessageListener();
	checkPendingQuery();
	setupInterval();
});

function setupUI() {
	console.log('Setting up UI...');

	var suggestChecked = autocompleteEnabled ? ' checked="checked"' : '';

	$('#fsr, #lh, #ft').append(
		'<div id="firewall">' +
			'<a href="#firewall" id="firewall-show">Firewall</a>' +
			'<form action="." id="firewall-form">' +
				'<label>Client ID: <input name="client-id" id="firewall-client-id" value="' + clientId + '"></label>' +
				'<label><input type="checkbox" id="firewall-suggest"' + suggestChecked + '> Suggest sensitive queries</label>' +
				'<input type="submit" value="Save">' +
			'</form>' +
		'</div>'
	);

	var $firewallShow = $('#firewall-show'),
		 $firewallForm = $('#firewall-form'),
		 $firewallClientId = $('#firewall-client-id'),
		 $firewallSuggest = $('#firewall-suggest')[0],
		 $body = $(document.body);

	$firewallShow.click(function(e) {
		e.preventDefault();
		$firewallForm.toggleClass('visible');
	});

	// On Firewall form submit, update user preferences.
	$firewallForm.submit(function(e) {
		e.preventDefault();
		clientId = $firewallClientId.val();
		autocompleteEnabled = $firewallSuggest.checked;
		var autocompleteStatus = (autocompleteEnabled ? 'on' : 'off');

		storage.set({
			clientId: clientId,
			autocompleteEnabled: autocompleteStatus
		}, function() {
			console.log('Changing settings...');
			console.log('Firewall client: ' + clientId);
			console.log('Autocomplete: ' + autocompleteStatus);
			$firewallForm.removeClass('visible');
		});

		if (autocompleteEnabled) {
			$googleInput.autocomplete({
				source: sensitiveQueries
			});
			$googleInput.autocomplete('enable');
			$body.addClass('firewall-autocomplete');
		} else {
			$googleInput.autocomplete('disable');
			$body.removeClass('firewall-autocomplete');
		}
	});

	// Set initial autocomplete preferences.
	if (autocompleteEnabled) {
		$googleInput.autocomplete({
			source: sensitiveQueries
		});
		$body.addClass('firewall-autocomplete');
	}

	var msg = 'Please wait while we archive your search results in the FIREWALL Cafe library...';
	$('#lst-ib').closest('.sbtc').append('<div id="firewall-loading">' + msg + '</div>');
	$('#kw').closest('form').append('<div id="firewall-loading">' + msg + '</div>');
}

function setupIntroScreen() {
	var logo = chrome.extension.getURL('/icons/firewall-white.png');
	var html = '<img src="' + logo + '">';
	html += '<div class="text">';
	if (window.location.hostname == 'www.google.com') {
		html += '<strong>Welcome to FIREWALL Cafe! Please take a moment to explore.</strong>';
		html += '<br><input id="firewall-intro-name" placeholder="What is your name?">';
		html += '<br><a href="#" id="firewall-begin">Let’s begin!</a>';
		html += '<ol>';
		html += '<li>Type a phrase into Google Image Search.</li>';
		html += '<li>Your query will be auto-translated into Chinese and used to search for images from Baidu Image Search.</li>';
		html += '<li>Please wait patiently after you search so we can save a copy of the images for our archive.</li>';
		html += '<li>Once we’ve archived your images, tell us what you think: were the results censored? Mistranslated? NSFW?</li>';
		html += '<li>Have fun, and view your archived search session images at firewallcafe.com!</li>';
		html += '</ol>';
	} else {
		html += '<p>FIREWALL is a socially engaged research and interactive art project designed to foster public dialogue about Internet freedom. The goal of this art project is to investigate online censorship by comparing the disparities of Google searches in western nations versus Baidu searches in China.  The motivation behind the project is to confront censorship through a participatory discovery process of Internet visual culture.</p>';
		html += '<p>FIREWALL是一个社会互动性的美术研究项目，旨在培育有关网络自由的公众对话。此美术项目通过比较西方国家的谷歌搜寻结果及中国的百度搜寻结果来探讨网路审查的问题。本项目的动机来自于利用参与性的方法和网络视觉文化来对抗网路审查。</p>';
	}
	html += '</div>';
	$(document.body).append('<div id="firewall-intro">' + html + '</div>');
	$('#firewall-begin').click(function(e) {
		e.preventDefault();
		var name = $('#firewall-intro-name').val();
		if (name == '') {
			name = 'Anonymous';
		}
		storage.set({
			clientId: name
		});
		$(document.body).removeClass('firewall-intro');
	});
}

function setupInterval() {
	console.log('Setting up URL checking interval...');
	setInterval(function() {
		checkURLQuery();
	}, 100);
}

function setupStorageListener() {
	console.log('Setting up storage listener...');

	// Listen to chrome storage for changes.
	chrome.storage.onChanged.addListener(function(changes, area) {

		// Ignore changes that aren't happening in local storage.
		if (area != 'local') {
			return;
		}

		// If the client performs a search and saves results to storage,
		// update the pending query with the incoming data.
		if (changes.pendingQuery) {
			pendingQuery = $.extend(pendingQuery, changes.pendingQuery.newValue);
			checkPendingQuery();
			checkPendingImages();
		}
	});
}

function setupMessageListener() {
	console.log('Setting up messages listener...');
	chrome.runtime.onMessage.addListener(function(e) {
		console.log('MSG: ' + e.type, e);
		if (e.type == 'toggle_input') {
			/*
			if (e.enabled) {
				window.onbeforeunload = null;
			} else {
				window.onbeforeunload = function() {
					var dialog = 'Please wait a moment while we save your search.';
					e.returnValue = dialog;
					return dialog;
				};
			}
			*/
			if (e.enabled) {
				$(document.body).removeClass('firewall-loading');
			}
			toggleInputField(e.enabled);
		} else if (e.type == 'images_loading') {
			$(document.body).addClass('firewall-loading');
		} else if (e.type == 'sleep_start') {
			$(document.body).addClass('firewall-intro');
		}
	});
}

function checkPendingQuery() {
	if (pendingQuery.query) {
		console.log("Pending query: ");
		console.log(pendingQuery);
	}

	// If we're ignoring incoming query data because we're in the middle of handling a query, move on.
	if (ignorePending) {
		console.log('Ignoring pending queries.');
		return;
	}

	// Look at the URL query string to get the search term.
	var queryMatch = getQueryMatch();
	if (queryMatch) {
		console.log('URL search term is:', queryMatch);
	}

	// Timestamp this query.
	var currTime = (new Date()).getTime();

	// If the search term is the translation of an original search term, move on.
	if (pendingQuery &&
	    pendingQuery.translated &&
	    pendingQuery.translated == queryMatch) {
		// We've just searched for this one, let getImages take it from here
		console.log('Already getting these images.');
		return;
	} else if (pendingQuery &&
	           pendingQuery.timestamp &&
	           currTime - pendingQuery.timestamp > 60 * 1000) {
		// Pending queries expire after 1 min.
		// If the query has expired, reset everything.
		console.log('Query has expired.');
		pendingQuery = {};
		storage.set({
			pendingQuery: {}
		}, function() {
			console.log('Reset query.');
		});
		// toggleInputField(true, function(){
		// 	console.log('Input field enabled.');
		// });
	} else if (pendingQuery.query &&
	           pendingQuery.searchEngine != getSource()) {
		// If the origin of the search was in the other search engine,
		// start a search for the term in the current search engine.
		console.log('Found a pending query from', pendingQuery.source, ':', pendingQuery.query);
		console.log('SETTING ignorePending to TRUE');
		ignorePending = true;
		searchPendingQuery();
	}
}

function checkURLQuery() {
	// Look at the URL query string to find the search term.
	var queryMatch = getQueryMatch();

	// If there's nothing that looks like a search term in the URL, keep polling.
	if (!queryMatch) {
		return;
	}

	if (ignoreSubmit) {
		query = queryMatch;
		ignoreSubmit = false;
		// toggleInputField(true, function(){
		// 	console.log('Input field enabled.');
		// })
		return;
	}

	// If the URL search term is not the query, that means we're about to start handling
	// a new search.
	if (queryMatch != query) {
		// Update the query.
		query = queryMatch;
		if (!query) {
			return;
		}

		console.log('Detected a', getSource(),'search: ' + query);
		chrome.runtime.sendMessage({
			type: 'toggle_input',
			enabled: false
		});

		var timestamp = (new Date().getTime());

		// Check to see if the ongoing query has any history.
		var isPending = checkPending(query);

		// If the primary search term is pending and is the original "source" search term,
		// just continue along.
		if (isPending == 'source') {
			console.log('Query is already pending');
			return;
		} else if (isPending == 'translated') {
			// If the primary search term is pending and is the translation of an original search,
			// start ignoring subsequent pending queries and begin getting images.
			console.log('Translation: ' + pendingQuery.translated);
			console.log('SETTING ignorePending to TRUE');
			ignorePending = true;
			startGettingImages();
		} else {
			// If neither search is in progress,
			// start the first query for images.
			startQuery(query, function(result) {
				console.log('Translated query: ' + result.translated);
				pendingQuery = $.extend(result, {
					timestamp: timestamp,
					googleImages: null,
					baiduImages: null
				});

				storage.set({
					pendingQuery: pendingQuery
				}, function() {
					console.log('Saved query to pending: ' + result.query);
				});
				startGettingImages();
			});
		}
	}
}

function startQuery(query, callback) {
	console.log('Starting query for ' + query);

	var data = {
		query: query,
		searchEngine: getSource(),
		secret: config.sharedSecret
	};
	$.ajax({
		url: config.serverURL + 'query',
		method: 'POST',
		data: data
	}).done(function(result) {
		console.log(result);
		callback(result);
	}).fail(function(xhr, textStatus) {
		console.log('Failed query: ' + textStatus + ' / ' + xhr.responseText);
	});
}

function startGettingImages() {
	if (getImagesTimeout) {
		clearTimeout(getImagesTimeout);
		getImagesTimeout = null;
	}
	setTimeout(function() {
		getImages();
	}, 2000);
}

function checkPending(query) {
	if (pendingQuery) {
		if (pendingQuery.translated == query) {
			return 'translated';
		} else if (pendingQuery.query == query) {
			return 'source';
		}
	}
	return false;
}

function searchPendingQuery() {
	console.log('Searching for', pendingQuery.translated, '(translation of', pendingQuery.query, ') in', getSource());

	var $inputField = findInputField();

	var inputQuery = 'input[name=q], input[name=word]';
	if ($(inputQuery).length == 0 ||
	    $(inputQuery).first().closest('form').length == 0) {
		console.log('Could not find form input, giving up.');
		console.log('SETTING ignorePending to FALSE');
		ignorePending = false;
		return;
	}

	$(inputQuery).first().val(pendingQuery.translated);
	$inputField.first().closest('form').submit();
}

function findInputField() {
	var inputField = 'input[name=q], input[name=word]',
		$inputField = $(inputField);

	if ($inputField.length == 0 || $inputField.first().closest('form').length == 0) {
		console.log('Could not find form input. Giving up.');
		console.log('SETTING ignorePending to FALSE');
		ignorePending = false;
		return;
	}
	return $inputField.first();
}

function getImages() {
	if (! pendingQuery ||
	    ! pendingQuery.query) {
		return;
	}

	var imagesKey = getSource() + 'Images';
	var retryKey = getSource() + 'Retries';
	var numImages = 20;
	var maxRetries = 5;

	// If getting images from Baidu, look for the phrase indicating banned search.
	if (getSource() == 'baidu') {
		var banned = $('body:contains("根据相关法律法规和政策，部分搜索结果未予显示")').length > 0;
		if (banned) {
			pendingQuery['banned'] = true;
		} else {
			pendingQuery['banned'] = false;
		}
	}

	if (! pendingQuery[retryKey]) {
		pendingQuery[retryKey] = 0;
	}

	console.log('Gathering', getSource(), 'images for ' + pendingQuery.query);

	function _deriveHref(image) {
		var parent = image.parentNode;
		if (parent.nodeName != 'A') {
			return null;
		}
		// The URL is buried in a query arg of the parent link's href.
		var href = $(parent).attr('href');
		if (href.match(/url=([^&]+)/)) {
			// Baidu uses 'objurl', Google uses 'imgurl'
			var url = href.match(/url=([^&]+)/)[1];
			return decodeURIComponent(url);
		}
		return null;
	}

	function _dedupeLimitedSet(imageSet, image) {
		var href = _deriveHref(image);
		var dupe = false;
		$.each(imageSet, function(i, img) {
			if (img.href == href) {
				dupe = true;
			}
		});
		if (href && ! dupe &&
		    imageSet.length < numImages) {
			imageSet.push({
				href: href,
				src: image.src
			});
		}
	}

	if (pendingQuery[imagesKey]) {
		var images = pendingQuery[imagesKey];
	} else {
		var images = [];
	}
	$('.imglist img').each(function(i, img) {
		// Baidu images
		_dedupeLimitedSet(images, img);
	});
	$('#rg .rg_l img').each(function(i, img) {
		// Google images
		_dedupeLimitedSet(images, img);
	});

	console.log('Found ' + images.length + ' images from', getSource());
	pendingQuery[imagesKey] = images;

	if (images.length < numImages &&
	    pendingQuery[retryKey] < maxRetries) {
		pendingQuery[retryKey]++;
		console.log('Still only have ' + images.length + ' images; retry in 2 seconds (' + pendingQuery[retryKey] + ' of ' + maxRetries + ')');
		startGettingImages();
	} else if (! checkPendingImages()) {
		// If we don't have all the images yet, save the first crop of them to storage
		storage.set({
			pendingQuery: pendingQuery
		});
		console.log('SETTING ignorePending to FALSE');
		ignorePending = false;
	}
}

function checkPendingImages() {
	if (pendingQuery && pendingQuery.googleImages && pendingQuery.baiduImages) {
		console.log('Image gathering complete.');

		if (pendingQuery.googleImages.length) {
			console.log('Looks like we have', pendingQuery.googleImages.length, 'images from Google!');
		} else {
			console.log('No image results from Google. :(');
		}

		if (pendingQuery.baiduImages.length) {
			console.log('Looks like we have', pendingQuery.baiduImages.length, 'images from Baidu!');
		} else {
			console.log('No image results from Baidu. :(');
		}

		// If we have results from both search engines, submit them ... annnd we're done
		submitImages(function() {
			console.log('Removing pending query');
			pendingQuery = {};
			storage.set({
				pendingQuery: {}
			});
			console.log('SETTING ignorePending to FALSE');
			ignorePending = false;
		});
		return true;
	}

	return false;
}

function toggleInputField(enable) {
	console.log('toggling input field: ' + enable);
	var input = document.querySelector('input[name=word], input[name=q]');
	if (input) {
		input.disabled = ! enable;
		console.log(input);
	}
}

function submitImages(callback) {
	// WordPress will get all of the data-URI image data
	var wp_data = {
		timestamp: pendingQuery.timestamp,
		client: clientId,
		secret: config.sharedSecret,
		search_engine: pendingQuery.searchEngine,
		query: pendingQuery.query,
		translated: pendingQuery.translated,
		lang_from: pendingQuery.langFrom,
		lang_to: pendingQuery.langTo,
		lang_confidence: pendingQuery.langConfidence,
		lang_alternate: pendingQuery.langAlternate,
		lang_name: pendingQuery.langName,
		google_images: JSON.stringify(pendingQuery.googleImages),
		baidu_images: JSON.stringify(pendingQuery.baiduImages),
		banned: pendingQuery.banned,
		sensitive: pendingQuery.sensitive
	};

	var googleImageUrls = [];
	$.each(pendingQuery.googleImages, function(i, image) {
		googleImageUrls.push(image.href);
	});
	var baiduImageUrls = [];
	$.each(pendingQuery.baiduImages, function(i, image) {
		baiduImageUrls.push(image.href);
	});

	// Google Sheets will get *just* the image URLs
	var gs_data = jQuery.extend(true, {}, wp_data);
	gs_data.google_images = JSON.stringify(googleImageUrls);
	gs_data.baidu_images = JSON.stringify(baiduImageUrls);

	console.log('google images');
	console.log(wp_data.google_images.substr(0, 100));

	console.log('google image urls');
	console.log(gs_data.google_images.substr(0, 100));

	console.log('Sending post to WP.');
	var url = config.libraryURL;

	chrome.runtime.sendMessage({
		type: 'images_loading'
	});

	$.ajax({
		url: url,
		method: 'POST',
		data: wp_data,
	}).done(function(rsp){
		console.log('Done sending post to WP.');
		console.log(rsp);
		rsp.type = 'images_saved';
		chrome.runtime.sendMessage(rsp);
		callback();
	}).fail(function(xhr, textStatus) {
		chrome.runtime.sendMessage({
			type: 'images_saved'
		});
		console.log('Failed sending post to WP:', textStatus, '/', xhr.responseText);
	});

	// Send data back to server for entry into the Google spreadsheet.
	console.log('Saving images to spreadsheet');
	var url = config.serverURL + 'submit-images';
	$.ajax({
		url: url,
		method: 'POST',
		data: gs_data
	}).done(function() {
		console.log('Done saving images to spreadsheet');
		// callback();
	}).fail(function(xhr, textStatus) {
		console.log('Failed submitting images to library: ' + textStatus + ' / ' + xhr.responseText);
	});
}

// Looks at URL query string and extracts search term.
function getQueryMatch() {
	var regex = /[^a-zA-Z0-9](q|word)=([^&]+)/;
	var queryMatch = location.hash.match(regex);
	if (!queryMatch) {
		queryMatch = location.search.match(regex);
	}
	if (!queryMatch) {
		return null;
	}
	queryMatch = decodeURIComponent(queryMatch[2]).replace(/\+/g, ' ');
	queryMatch = normalizeQuery(queryMatch);
	return queryMatch;
}

function normalizeQuery(query) {
	var normalized = query.toLowerCase().trim();
	return normalized;
}

function getSource() {
	return location.hostname.replace('www.', '')
	                        .replace('image.', '')
	                        .replace('.com', '');
}

function randomClientId() {
	return 'Client ' + (100 + Math.floor(Math.random() * 900));
}
