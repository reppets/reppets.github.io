// ==UserScript==
// @name        tumblr-lib
// @namespace   reppets.net
// @version     1.0.0
// @require     https://raw.githubusercontent.com/ddo/oauth-1.0a/14eed75a02833a5892caaedc7dfa94eb608df92a/oauth-1.0a.js
// @require     https://raw.githubusercontent.com/brix/crypto-js/svn-mirror/3.1.2/build/rollups/hmac-sha1.js
// @require     https://raw.githubusercontent.com/brix/crypto-js/svn-mirror/3.1.2/build/components/enc-base64-min.js
// @grant       GM_xmlhttpRequest
// ==/UserScript==

// ========== Tumblr prototype ==========
var Tumblr = function(consumer_key, consumer_secret, logLevel) {
	this.consumer_key = consumer_key;
	this.consumer_secret = consumer_secret;
	this.oauth = OAuth({
		consumer: { public: consumer_key, secret: consumer_secret },
		signature_method:'HMAC-SHA1'
	});
	this.logLevel = logLevel ? logLevel : Tumblr.log.NONE;
};

Tumblr.AUTHORIZE_URL = 'https://www.tumblr.com/oauth/authorize';

Tumblr.log.NONE = 2;
Tumblr.log.ERROR = 1;
Tumblr.log.DEBUG = 0;

Tumblr._log = function(targetFunction) {
	self = this;
	return function() {
		if (self.logLevel <= Tumblr.log.DEBUG) {
			console.log(arguments);
		}
		try {
			return targetFunction.apply(this, arguments);
		} catch(e) {
			if (self.logLevel <= Tumblr.log.ERROR) {
				console.log(e);
			}
			throw e;
		}
	};
};

/*
  call GM_xmlhttpRequest with the OAuth headers.
 */ 
Tumblr.prototype.requestOAuth = function(args, token) {
	if (args.method==='POST') {
		if (!args.headers) {
			args.headers = {'Content-Type': 'application/x-www-form-urlencoded'};
		} else if (!args.headers['Content-Type']) {
			args.headers['Content-Type'] = 'application/x-www-form-urlencoded';
		}
	}
	args.headers = this.oauth.mergeObject(
		args.headers ? args.headers : {},
		this.oauth.toHeader(this.oauth.authorize(args, token)));
	args.data = this.parameterize(args.data, false); // conversion for GM_xmlhttpRequest
	return GM_xmlhttpRequest(args);
};

/*
  call GM_xmlhttpRequest with the API Key.
 */
Tumblr.prototype.requestApiKey = function(args) {
	var parser = parseURL(args.url);
	if (parser.search) {
		parser.search = parser.search + '&api_key=' + this.consumer_key;
		args.url = parser.href;
	} else {
		parser.search = '?api_key=' + this.consumer_key;
		args.url = parser.href;
	}
	return GM_xmlhttpRequest(args);
};

/*
 * map : key-value pairs for parameterizing.
 * addQuestion : boolean. adds heading '?' if true.
 * keys : key filter.
 */
Tumblr.prototype.parameterize = function(map, withQuestion, keys) {
	var ar = [];
	for (var key in map) {
		if (keys && keys.indexOf(key) < 0) {
			continue;
		}
		if (! map[key]) {
			continue;
		}
		ar.push(encodeURIComponent(key)+'='+encodeURIComponent(map[key]));
	}
	if (ar.length === 0) {
		return '';
	}
	return (withQuestion ? '?' : '') +ar.join('&');
};

Tumblr.prototype.getRequestToken = function(args) {
	args.url = 'https://www.tumblr.com/oauth/request_token';
	args.method = 'POST';
	return this.requestOAuth(args);
};

Tumblr.prototype.getAccessToken = function(token, args) {
	args.url = 'https://www.tumblr.com/oauth/access_token';
	args.method = 'POST';
	return this.requestOAuth(args, token);
};

/*
 * required properties for args:
 *   blogID: blog identifier (e.g. 'example.tumblr.com')
 */
Tumblr.prototype.getBlogInfo = Tumblr.log(function(blogID, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/info';
	args.method = 'GET';
	return this.requestApiKey(args);
});

/*
 * required properties for args:
 *   blogID: blog identifier (e.g. 'example.tumblr.com')
 * optional properties for args:
 *   size: avatar size (must be one of 16, 24, 30, 40, 48, 64, 96, 128, 512, default: 64)
 */
Tumblr.prototype.getAvatar = Tumblr.log(function(blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/avatar' + this.parameterize(params, true);
	args.method = 'GET';
	return GM_xmlhttpRequest(args);
});

/*
 *   blogID: blog identifier (e.g. 'example.tumblr.com')
 * acceptable keys for params:
 *   limit: number of results 1-20 inclusive (default: 20).
 *   offset: liked post number to start (default: 0(first post)).
 *   before: retrieves posts before this timestamp.
 *   after: retrieves posts after this timestamp.
 */
Tumblr.prototype.getLikes = Tumblr.log(function(blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/likes' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestApiKey(args);
});

Tumblr.prototype.getFollowers = Tumblr.log(function(token, blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/followers' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestOAuth(args, token);
});

Tumblr.prototype.getPosts = Tumblr.log(function(blogID, params, args) {
	var realParams = $.extend({}, params);
	delete realParams.type;
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/posts' + (params.type ? '/'+params.type : '') + this.parameterize(realParams, true);
	args.method = 'GET';
	return this.requestApiKey(args);
});

Tumblr.prototype.getDrafts = Tumblr.log(function(token, blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/posts/draft' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestOAuth(args, token);
});

Tumblr.prototype.getSubmissions = Tumblr.log(function(token, blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/posts/submission' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestOAuth(args, token);
});

Tumblr.prototype.post = Tumblr.log(function(token, blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID +'/post';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

Tumblr.prototype.edit = Tumblr.log(function(token, blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/post/edit';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

Tumblr.prototype.reblog = Tumblr.log(function(token, blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/post/reblog';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

Tumblr.prototype.delete = Tumblr.log(function(token, blogID, params, args) {
	args.url = 'https://api.tumblr.com/v2/blog/' + blogID + '/post/delete';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

Tumblr.prototype.getUserInfo = Tumblr.log(function(token, args) {
	args.url = 'https://api.tumblr.com/v2/user/info';
	args.method = 'GET';
	return this.requestOAuth(args, token);
});

Tumblr.prototype.getUserDashboard = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/user/dashboard' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestOAuth(args, token);
});

/*
 * accepted keys for params:
 *   limit
 *   offset
 *   before
 *   after
 */
Tumblr.prototype.getUserLikes = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/user/dashboard' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestOAuth(args, token);
});

/*
 * accepted keys for params:
 *   limit
 *   offset
 */
Tumblr.prototype.getUserFollowing = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/user/following' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestOAuth(args, token);
});

/*
 * accepted keys for params:
 *   url
 */
Tumblr.prototype.follow = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/user/follow';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

/*
 * accepted keys for params:
 *   url
 */
Tumblr.prototype.unfollow = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/user/unfollow';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

Tumblr.prototype.like = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/user/like';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

Tumblr.prototype.unlike = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/user/unlike';
	args.method = 'POST';
	args.data = params;
	return this.requestOAuth(args, token);
});

Tumblr.prototype.getTagged = Tumblr.log(function(token, params, args) {
	args.url = 'https://api.tumblr.com/v2/tagged' + this.parameterize(params, true);
	args.method = 'GET';
	return this.requestApiKey(args, token);
});
