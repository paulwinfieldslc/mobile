var AppManager = (function () {
    function AppManager() {
		this.logEvent("Starting application framework. Version 0.74.0", "info");
		this.location = {
			available: boolean = false,
		};
	
		if (navigator.geolocation) {
			this.location.available = true;
		}
		this.updateLocation();
	}

	AppManager.prototype.updateLocation = function(callback, options) {
		var instance = this;
		var defaultOptions = {
			enableHighAccuracy: true,
			timeout: 5000,
			maximumAge: 0
		};
		  
		function gotLocation(pos) {
			application.logEvent("location: " + JSON.stringify(pos), "info");
		  var crd = pos.coords;
		  if (callback) {
			  callback(undefined, crd);
		  }
		  instance.location.cachedLocation = crd;
		}
		function locationError(err) {
			if (callback) { callback(err); }
		}
		
		if (this.location.available) {
			navigator.geolocation.getCurrentPosition(gotLocation, locationError, options || defaultOptions);
		}
		else if (callback) {
			callback({ "message": "Location services not available" });
		}
	}

	AppManager.prototype.pollingMonitor = function() {
		var instance = this;

		function runAutoSync() {
			var loginPage = cti.store.schema.metadata.loginpage || "Login";
			// PW No longer trusting currentPage tracking from state as it was getting out of sync.
			// Now using cti.store.variables.page which is manually set on page loaded of each page
			var currentPage = cti.store.variables.page;	//		cti.store.state.currentPage;

			// No sync will happen until we're logged in to the main app
			if (currentPage == loginPage) { return false; }
			// No sync if in Settings or Support pages either
			if (currentPage == "Support" || currentPage == "Settings") { return false; }


			if (!window.application) {
				console.error("Unable to perform automated sync, no Application object in scope!");
				return;
			}
			// Allow the app to get involved prior to processing the queue (so we can add calls to the queue for instance)
			if (cti.fnOnWillAutoSync) {
				cti.fnOnWillAutoSync();
			}
			console.log("trace:: Sync processing...");
			var queue = window.application._apiQueueRetrieve();
			window.application._apiProcessQueue(queue);
		}
		function runAuthCheckMonitor() {
			var loginPage = cti.store.schema.metadata.loginpage || "Login";
			var currentPage = cti.store.state.currentPage;
			if (currentPage == loginPage) { return false; }
			if (currentPage == "Support" || currentPage == "Settings") { return false; }
			var user = cti.store.user;
			if (!user || !user.token) {
				console.log("trace:: User redirected, in protected area without valid profile");
				cti.utils.callAction("go-to-page", { "name": loginPage });
				return false;
			}

			var now = new Date();
			var tokenExpiry = user.expiryTime;
			if (typeof tokenExpiry === "string") {
				tokenExpiry = new Date(tokenExpiry);
				user.expiryTime = tokenExpiry;
			}
			if (tokenExpiry !== undefined && tokenExpiry > now) {
				// We appear to be legitimately logged in. Nothing to see here!
			}
			else {
				console.log("trace:: User redirected, token invalid or expired");
				cti.utils.callAction("go-to-page", { "name": loginPage });
				return false;
			}
		}

		var interval = parseInt(cti.store.schema.metadata.apisyncinterval || 600000);
		if (isNaN(interval)) { interval = 600000; }

		runAuthCheckMonitor();
		setInterval(function () {
		    runAuthCheckMonitor();
		}, 2000);

		if (interval > 0) {
			console.log('trace:: Setting auto-sync interval = ' + interval);
			setInterval(function () {
				let t = window.application ? window.application.dateTimeDisplayStr() : '';
				console.log("trace:: " + t + " Syncing...");
				runAutoSync();
			}, interval);
		}
	}

	
	//======================================================================================================================
	//======================================================================================================================
	// Component helper stuff
	//======================================================================================================================
	//======================================================================================================================

	AppManager.prototype.startLoader = (msg) => {
		let result = document.querySelectorAll("ct-loader");
		if (result && result.length > 0) result[0].show(msg);
	}
	AppManager.prototype.stopLoader = () => {
		let result = document.querySelectorAll("ct-loader");
		if (result && result.length > 0) result[0].close();
	}





	//======================================================================================================================
	//======================================================================================================================
	// API Methods
	//======================================================================================================================
	//======================================================================================================================


	//======================================================================================================================
	// Initialise an object with all of the default stuff we need in the API headers for every call
	AppManager.prototype.apiHeaders = function(messageId) {
		var details = {
			"messageid": messageId
		}
		var store = this.getCti(true);
		if (!store) { return details; }
		details.applicationkey = store.schema.metadata.applicationkey.toString();
        if (!store.user) { return details; }
		details["x-access-token"] = store.user.token;
		return details;
	}
	
	//======================================================================================================================
	// Make a queueable API call 
	AppManager.prototype.api = function(path, params) {
		this.logEvent("Call API " + path);
		// Generate the object that describes the call to be made. It will get auto-added
		// to the queue if ttl > -1
		if (!params) { params = {} }
		var _callObject = this._apiCallObject(
			path, 
			params.method, 
			params.payload, 
			params.responseActionFlow, 
			params.ttlSeconds, 
			params.filename,
			params.parentId,
			params.mimeType,
			params.apiStoreKey,
			params.queueAsPending, 
			params.noDuplicate
		);
		//_apiCallObject = function(path, method, payload, responseActionFlow, ttlSeconds, filename, parentId, mimeType, apiStoreKey) {
		// Make the API call now...
		if (_callObject && !params.queueAsPending) {
			this._apiProcessQueue([_callObject]);
		}
	}

	AppManager.prototype.api2 = function(path, method, payload, responseActionFlow, ttlSeconds) {
		this.logEvent("Call API " + path);
		// Generate the object that describes the call to be made. It will get auto-added
		// to the queue if ttl > -1
		var _callObject = this._apiCallObject(path, method, payload, responseActionFlow, ttlSeconds);
		// Make the API call now...
		this._apiProcessQueue([_callObject]);
	}

	AppManager.prototype.upload = function(path, filename, id, mimeType, responseActionFlow, ttlSeconds) {
		// Generate the object that describes the call to be made. It will get auto-added
		// to the queue if ttl > -1. With an upload, we need the filename, an id to aid in associating 
		var _callObject = this._apiCallObject(path, "POST", undefined, responseActionFlow, ttlSeconds, filename, id, mimeType);
		// Make the API call now...
		this._apiProcessQueue([_callObject]);
	}

	AppManager.prototype.login = function(path, responseActionFlow, options) {

		function loginFail(error) {
			if (responseActionFlow) {
				cti.utils.callActionflow(responseActionFlow, { error: error, success: false }).then(result => {  });
			}
			return false;
		}

		// FIgure out where we need to pull the credentials from
		var store = this.getCti(true);
		var loginPageName = store.schema.metadata.loginpage || "Login";
		var usernameField = (options && options.usernameField) ? options.usernameField : "username";
		var passwordField = (options && options.passwordField) ? options.passwordField : "password";
		var loginPageContent = store["pages"];

		// See if we have a page we can get the credential values from
		if (loginPageContent === undefined || loginPageContent[loginPageName] === undefined) {
			this.logError("Failed to find login credentials page for login request. Hint: Please ensure you have the metadta.loginpage parameter defined correctly.");
			return loginFail({ message: "No login credentials have been specified." });
		}

		var loginPageObject = loginPageContent[loginPageName];
		if (!loginPageObject[usernameField] || !loginPageObject[passwordField]) {
			this.logError("Failed to find login credentials for login request. Hint: Please ensure you have overriden the usernameField and passwordField in the login call if needed.");
			return loginFail({ message: "No login credentials have been specified." });
		}

		var credentials = {
			"username": loginPageObject[usernameField],
			"password": loginPageObject[passwordField]
		}

		// Ensure we have a clean state and no credentials are persisted
		delete loginPageObject[usernameField];
		delete loginPageObject[passwordField];

		this.clearUserProfile();
		this.api(path, { method: "POST", payload: credentials, responseActionFlow: responseActionFlow, ttlSeconds: -1});
		return true;
	}


	AppManager.prototype._apiProcessQueue = function(_queue) {
		if (!_queue || _queue.length < 1 || this._xhr() === undefined) {
			return false;
		}
		var processing = localStorage.getItem("processing-queue");
		if (processing) {
			this.logEvent("Unable to process API queue, still working", "warn");
			return;
		}

		var syncStartTime = new Date();
		var store = this.getCti(true);
		var apiHostAddress = store.variables.apiaddress || store.schema.metadata.apiaddress;
		var instance = this;
		var _queueProcessor = {
			index: 0,
			// Definition of the call object
			callObject: undefined,
			nextAPICall: function() {
				var now = new Date();
				this.callObject = _queue[this.index];
				// Check if the request may be processed
				if (this.callObject.completed) {
					this.done("completed");
				}
				else if (this.callObject.expiryTime !== 0 && this.callObject.attemptCount > 0 && this.callObject.expiryTime < now) {
					this.done("expired");
				}
				else if (this.callObject.filename) {
					this.callObject.attemptCount++;
					this.callObject.status = 'processing';
					// We need to handle files differently...
					var fileURL = this.callObject.filename;
					var uri = encodeURI(apiHostAddress + this.callObject.path);
					try {
						var options = new FileUploadOptions();
						options = { 
							fileKey: "upload", 
							fileName: fileURL.substr(fileURL.lastIndexOf('/') + 1), 
							mimeType: this.callObject.mimeType, 
							chunkedMode: false 
						};
						options.headers = instance.apiHeaders(this.callObject.id);
						var params = {};
						params.parentId = this.callObject.parentId;
						options.params = params;
						var ft = new FileTransfer();
						ft.onprogress = function (progressEvent) {	};
						ft.upload(fileURL, uri, _queueProcessor.processFileData, _queueProcessor.processFileDataFailure, options);
					}
					catch (e) {
						instance.logError("Exception in uploadFile", e);
						_queueProcessor.handleResponse(500, { message: e }, true);
					}
				}
				else {
					// Prepare a request
					var _xhr = instance._xhr();
					this.callObject.attemptCount++;
					this.callObject.status = 'processing';
					var _headers = instance.apiHeaders(this.callObject.id);
					_xhr.open(this.callObject.method, apiHostAddress + this.callObject.path, true);
					for (var k in _headers) {
						_xhr.setRequestHeader(k, _headers[k]);
					}
					_xhr.withCredentials = true;
					this.processRequest(_xhr);
				}
			},
			processFileData: function(result) {
				/*
			fileData response:: {
				"bytesSent": 10525,
				"responseCode": 200,
				"response": "{\"success\":true,\"httpStatus\":200,\"data\":\"Your file has been processed\"}",
				"objectId": ""
			}
				*/
				console.log("trace:: FileData response:: " + JSON.stringify(result, null, 4));
				if (typeof result.response === "object" && typeof result.response === "Object") {
					result.response = JSON.stringify(result.response);
				}
				_queueProcessor.handleResponse(result.responseCode, result.response, true);
			},
			processFileDataFailure: function(error) {
				_queueProcessor.handleResponse(500, { message: error }, true);
			},
			processRequest: function(xhr) {
				// Send the prepared xhr request
				var processorInstance = this;
				xhr.onreadystatechange = function() {
					var contentType = this.getResponseHeader('content-type');
					if (this.readyState == 4) {
						// Pass the response to be sanitised then dealt with
						processorInstance.handleResponse(this.status, this.responseText, contentType && contentType.indexOf("application/json") > -1);
					}
				}
				xhr.setRequestHeader("Content-Type", "application/JSON");
				xhr.send((this.callObject.payload) ? JSON.stringify(this.callObject.payload) : undefined);
			},
			handleResponse: function(httpStatus, responseText, isJson) {
				// Form the response into consistent packaging
				var response = (isJson) ? JSON.parse(responseText) : { httpStatus: httpStatus };
				if (!isJson) {
					response.message = (response.success) ? undefined : responseText;
					response.data = (response.success) ? responseText : undefined; 
				}
				var successCodes = [200,201,300,302];
				if (response.success === undefined) { 
					response.success = successCodes.indexOf(response.httpStatus) > -1; 
					if (response.httpStatus === 0 && !response.message) { response.message = "The client or server may be offline"; }
				}
				if (response.success) { this.processResponse(response); } else { this.processError(response); }
			},
			processResponse: function(response) {
				this.callObject.status = 'complete';
				this.callObject.lastError = undefined;
				response.date = new Date();
				if (this.callObject.apiStoreKey) {
					cti.store.api[this.callObject.apiStoreKey] = JSON.parse(JSON.stringify(response));
				}
				if (this.callObject.responseActionFlow) {
					console.log('trace:: Call action flow "'+ this.callObject.responseActionFlow +'" with response');
					cti.utils.callActionflow(this.callObject.responseActionFlow, { response: response, success: true }).then(result => { this.updateStatus(response); });
				}
				else {
					this.updateStatus(response);
				}
			},
			processError: function(response) {
				this.callObject.status = 'errored';
				this.callObject.lastError = response.message;
				let unauthorisedActionFlow = (cti.store.schema.metadata && cti.store.schema.metadata.RequestUnauthorisedActionFlow) ? cti.store.schema.metadata.RequestUnauthorisedActionFlow : undefined;
				let authFailCodes = [401,403];
				let wasLoginCall = ["auth", "login", "token"].indexOf(this.callObject.path.toLowerCase()) > -1;
				
				instance.logError("API call " + this.callObject.path + " failed; code: " + (response.httpStatus || "(unknown)") + ", message: "+ (response.message || "(none)"));
				// If we have an auth fail, and we have a handler assigned for dealing with API auth failures (generally token fail)
				if (!wasLoginCall && (authFailCodes.indexOf(response.httpStatus) > -1) && unauthorisedActionFlow) {
					// Tell the caller if we're using an offline token
					let offlineToken = (cti.store && cti.store.user && cti.store.user.token) ? cti.store.user.token == "local" : false;
					cti.utils.callActionflow(unauthorisedActionFlow, { error: response, success: false, usingLocalToken: offlineToken })
						.then(result => { 
							console.log("trace:: Return from actionFlow "+ unauthorisedActionFlow +" with response: " + JSON.stringify(result));
							this.finished(); 
						});
				}
				else if (this.callObject.responseActionFlow) {
					instance.logEvent("Call actionFlow "+ this.callObject.responseActionFlow +" with error");
					cti.utils.callActionflow(this.callObject.responseActionFlow, { error: response, success: false, attempts: this.callObject.attemptCount })
						.then(result => { 
							console.log("trace:: Return from actionFlow "+ this.callObject.responseActionFlow +" with response: " + JSON.stringify(result));
							this.updateStatus(result, true); 
						});
				}
				else {
					this.updateStatus(undefined, true); // Let the queue dictate if we need to try again
				}
			},
			updateStatus: function(result, error) {
				if (!error) {
					this.callObject.completed = new Date();
					this.done("processed");
				}
				else {
					var requeue = true;
					if (result && result.retry !== undefined) { requeue = result.retry; }
					if (requeue===undefined || requeue===true) { this.done("pending");}
					else { this.done("failed"); }
				}
			},
			done: function(status) {
				console.log("trace:: Completed request " + this.callObject.id);
				if (status) { this.callObject.status = status; };
				if (++this.index == _queue.length) { this.finished(); } else { this.nextAPICall(); }
			},
			finished: function() {
				// Cleanse is synchronous, but quick
				instance._apiCleanseQueue(_queue);
				var syncDuration = (new Date() - syncStartTime) / 1000;
				console.log("trace:: Sync complete in " + syncDuration + " seconds");
				return true;
			}
		}
		_queueProcessor.nextAPICall();
	}


	AppManager.prototype._apiCleanseQueue = function(_queue) {
		var processing = localStorage.getItem("processing-queue");
		if (processing) {
			this.logEvent("Unable to housekeep API queue, still working", "warn");
			return;
		}
		localStorage.setItem("processing-queue", "1");
		var now = new Date();
		var l = _queue.length;
		for (var i = l-1; i >= 0; i--) {
			var queueitem = _queue[i];
			var expired = (queueitem.expiryTime === undefined || queueitem.expiryTime !== 0 && queueitem.attemptCount > 0 && queueitem.expiryTime < now);
			
			var candelete = (queueitem.completed) || (queueitem.attemptCount > 0 && queueitem.status !== "pending");

			if (expired || candelete) {
				if (expired) {
					console.log("trace:: Expired API call deleted from queue " + queueitem.status);
				}
				else {
					console.log('trace:: Delete item from queue ' + queueitem.status);
				}
				_queue.splice(i, 1);
			}
		}
		localStorage.removeItem("processing-queue");
	}

	AppManager.prototype._xhr = function() {
		if (window.XMLHttpRequest) { // Mozilla, Safari, ...
			return new XMLHttpRequest();
		} else if (window.ActiveXObject) { // IE
			try {
				return new ActiveXObject('Msxml2.XMLHTTP');
			} 
			catch (e) {
			try {
				return new ActiveXObject('Microsoft.XMLHTTP');
			} 
			catch (e) {}
			}
		}
		return undefined;
	}

	AppManager.prototype._apiQueueRetrieve = function() {
		var store = this.getCti(true);
		if (!store) { return undefined; }
		if (store.apiqueue == undefined) { store.apiqueue = []; }
		return store.apiqueue;
	}

	AppManager.prototype._apiCallObject = function(path, method, payload, responseActionFlow, ttlSeconds, filename, parentId, mimeType, apiStoreKey, queueAsPending, noDuplicate) {
		// Ensure we have a default for the ttl
		if (ttlSeconds === undefined) { ttlSeconds = 0; }
		var expiryTime = (ttlSeconds < 1) ? undefined : new Date((new Date()).getTime() + ttlSeconds*1000);
		var queue = this._apiQueueRetrieve();
		var apiCallDefinition = {
			"id": this.newGuid(),
			"path": path,
			"method": method || "POST",
			"payload": payload,
			"attemptCount": 0,
			"responseActionFlow": responseActionFlow,
			"expiryTime": ttlSeconds === 0 ? 0 : expiryTime,
			"filename": filename,
			"parentId": parentId,
			"mimeType": !filename ? undefined : (mimeType || "image/jpeg"),
			"apiStoreKey": apiStoreKey
		}

		// If we've said noDuplicate, we can't have an existing queued call to the same path already present
		if (noDuplicate === true) {
			let existingMatch = queue.find(q => q.path == apiCallDefinition.path && q.payload == apiCallDefinition.payload && !q.completed);
			if (existingMatch) {
				console.log('trace:: API call request rejected, similar one already queued');
				return undefined;
			}
		}

		// If it's a retryable opteration, add it to the queue
		// If marked as queueAsPending, we aren't explicity sending now, we're waiting for the next scheduled processing of the queue
		if (ttlSeconds > -1 || queueAsPending === true) {
			queue.push(apiCallDefinition);
		}

		return apiCallDefinition;
	}




	//======================================================================================================================
	//======================================================================================================================
	// User profile management
	//======================================================================================================================
	//======================================================================================================================


	//======================================================================================================================
	// Stored logged in user credentials in the profile
	// default location: cti.store.api.default.login(.data)
	AppManager.prototype.setUserProfile = function (profile) {
		var store = this.getCti(true);
		var userProfile = JSON.parse(JSON.stringify(profile.data || profile));
		if (store) { 
			this.logEvent("User profile stored");
			store.user = userProfile;
		}
		return userProfile;
	}

	//======================================================================================================================
	// Clear the user session
	AppManager.prototype.clearUserProfile = function () {
		var store = this.getCti(true);
		if (store) { delete store.user; }
		this.logEvent("User profile cleared");
		this.goto(store.schema.metadata.loginpage || "Login", true);
	}
	AppManager.prototype.logout = function () {
		this.clearUserProfile();
		this.logEvent("User logged out", "info");
	}

	//======================================================================================================================
	// Get user profile
	AppManager.prototype.getUserProfile = function() {
		var store = this.getCti(true);
		return (store) ? store.user : undefined;
	}


	//======================================================================================================================
	//======================================================================================================================
	// Navigation stuff
	//======================================================================================================================
	//======================================================================================================================

	AppManager.prototype.goto = function (pageName, dontAddNewPageToStack) {
		cti.utils.callAction("go-to-page", { "name": pageName });
		if (dontAddNewPageToStack === true) {
			console.log("trace:: Remove page (" + pageName + ") from stack");
			this.removeCurrentPageFromStack();
		}
	}

	AppManager.prototype.back = function () {
		cti.utils.callAction("go-back");
	}

	AppManager.prototype.clearStack = function() {
		localStorage.removeItem(cti.store.schema.name + "_stack");
	}

	AppManager.prototype.removeCurrentPageFromStack = function() {
		const stackKey = cti.store.schema.name + "_stack";
		let str = localStorage.getItem(stackKey);
		if (str) {
			let data = JSON.parse(str);
			if (data && Array.isArray(data) && data.length > 0) {
				data.splice(data.length-1, 1);
				setTimeout(() => { localStorage.setItem(stackKey, JSON.stringify(data)); }, 200);
			}
		}
	}

	AppManager.prototype.infoMessage = function(message, title, notificationName) {
		cti.utils.callAction("show-notification", { "name": notificationName || "InfoMessage", "title": title || "Information", "text": message });
		return true;
	}
	AppManager.prototype.warningMessage = function(message, title, notificationName) {
		cti.utils.callAction("show-notification", { "name": notificationName || "WarningMessage", "title": title || "Warning", "text": message });
		return false;
	}
	AppManager.prototype.errorMessage = function(message, title, notificationName) {
		cti.utils.callAction("show-notification", { "name": notificationName || "ErrorMessage", "title": title || "Error", "text": message });
		return false;
	}


	//======================================================================================================================
	//======================================================================================================================
	// Logging utils
	//======================================================================================================================
	//======================================================================================================================


	//======================================================================================================================
	// Log an event to console and append to the event log buffer, which can be displayed to in the UI if required
	//   message : Message text t be logged
	//   category : Message category. Free text, but suggest - debug | info | warning | error
	AppManager.prototype.logEvent = function (message, category) {
        var t = this.dateTimeDisplayStr();
		var c = (category || 'debug');
		var entry = c + (":: " + t + "  " + message);
		console.log(entry);
		var store = this.getCti(true);
		if (!store) { return; }
		if (store.log == undefined) { store.log = []; }
		store.log.splice(0, 0, { "time": t, "type": c, "message": message });
		var l = store.log.length;
		var m = 200;
		if (l > m) {
		    store.log.splice(m, l-m);
		}
    }

	//======================================================================================================================
    // Log an event to console and append to the event log buffer, which can be displayed to in the UI if required
    //   message : Message text t be logged
    //   errObjectOrString : err object - designed to deal with error processing from a callback function
    //   category : Message category. Free text, but suggest - debug | info | warning | error
    AppManager.prototype.logError = function (message, errObjectOrString, category) {
        var error = (typeof errObjectOrString === "object") ? JSON.stringify(errObjectOrString) : errObjectOrString;
        var logMessage = message;
        if (logMessage === undefined || logMessage == '') {
            logMessage = error || '(undefined error)';
        }
        else if (error !== undefined && error != '') {
            logMessage += ('; ' + error);
        }
        this.logEvent(logMessage, (category || 'error'));
    }




	//======================================================================================================================
	//======================================================================================================================
	// Date utils
	//======================================================================================================================
	//======================================================================================================================


	//======================================================================================================================
    // Helper function to compare if two dates are the same (ignoring time)
    AppManager.prototype.areDatesEqual = function (date1, date2) {
        var d1 = (typeof date1 === "string") ? new Date(date1) : date1;
        var d2 = (typeof date2 === "string") ? new Date(date2) : date2;
        return (d1 !== undefined && d2 !== undefined && d1.getFullYear() == d2.getFullYear() && d1.getMonth() == d2.getMonth() && d1.getDate() == d2.getDate());
    }

	//======================================================================================================================
	// Gets a display friendly date time - for logging etc
	AppManager.prototype.dateTimeDisplayStr = function() {
		var d = new Date();
		var min = d.getMinutes();
		var sec = d.getSeconds();
		if (min < 10) {
			min = "0" + min;
		}
		if (sec < 10) {
			sec = "0" + sec;
		}
		var dateStr = d.getDate() + '/' + (d.getMonth()+1) + '/' + d.getFullYear();  
		return dateStr + ' ' + (d.getHours() + ':' + min + ':' + sec + '.' + d.getMilliseconds());
	}

    AppManager.prototype.ensureDate = function(date) {
        if (!date) {
            return undefined;
        }

        if (typeof date === "string") {
            return new Date(date);
        }
        return date;
    }

    AppManager.prototype.dbDate = function(date) {
        var d = this.ensureDate(date);
        if (!d) {
            return undefined;
        }

        return d.getFullYear().toString() + '-' + (d.getMonth()+1).toString() + '-' + d.getDate().toString();
    }

    AppManager.prototype.dbDatetime = function(date) {
        var d = this.ensureDate(date);
        if (!d) {
            return undefined;
        }

        return d.getFullYear().toString() + '-' + (d.getMonth()+1).toString() + '-' + d.getDate().toString() + ' ' + d.toLocaleTimeString();
    }


	//======================================================================================================================
	//======================================================================================================================
	// Pouch database functions
	//======================================================================================================================
	//======================================================================================================================


	//======================================================================================================================
	AppManager.prototype.saveToDatabase = function (recordKey, recordData, onSuccess, onFail) {
	    var pouch = new PouchDB("InfinityAppManager");
	    pouch.get(recordKey)
            .then(function (doc) {
                // Already have that key, it's an update
                pouch.put({ _id: recordKey, _rev: doc._rev, data: recordData })
                    .then(function (response) {
                        onSuccess(doc._rev);
                    })
                    .catch(function (err) {
                        onFail("Failed to update record", err);
                    });
            })
            .catch(function (err) {
                if (err.status == 404) {
                    pouch.put({ _id: recordKey, data: recordData })
                        .then(function (response) {
                            onSuccess("(new)");
                        })
                        .catch(function (err2) {
                            onFail("Failed to add record", err2);
                        })
                }
                else {
                    onFail("Failed to retrieve record", err);
                }
            })
	}

	//======================================================================================================================
	AppManager.prototype.loadFromDatabase = function (recordKey, onSuccess, onFail) {
	    var pouch = new PouchDB("InfinityAppManager");
	    pouch.get(recordKey)
            .then(function (doc) {
                onSuccess(doc);
            })
            .catch(function (err) {
                if (err.status == 404) {
                    onFail("Record does not exist", err);
                }
                else {
                    onFail("Failed to retrieve record", err);
                }
            })
	}

	//======================================================================================================================
	AppManager.prototype.deleteFromDatabase = function (recordKey, onSuccess, onFail) {
	    var pouch = new PouchDB("InfinityAppManager");
	    pouch.get(recordKey)
            .then(function (doc) {
                db.remove(doc._id, doc._rev);
                onSuccess(doc._rev);
            })
            .catch(function (err) {
                if (err.status == 404) {
                    onSuccess("(none)");
                }
                else {
                    onFail("Failed to retrieve record", err);
                }
            })
	}
	



	//======================================================================================================================
	//======================================================================================================================
	// Misc helper functions
	//======================================================================================================================
	//======================================================================================================================


	//======================================================================================================================
	// Retrieve a keyed item from the app metadata
	AppManager.prototype.getMetadataValue = function(key, defaultValue) {
		var result = defaultValue;
		if (window.cti !== undefined && window.cti.store !== undefined && window.cti.store.schema.metadata !== undefined) {
			result = window.cti.store.schema.metadata[key];
			if (result == undefined || result == '') {
				result = defaultValue;
			}
		}
		logEvent('Retrieve metadata: ' + key + ' = ' + result);
		return result;
	}

	//======================================================================================================================
	AppManager.prototype.getCti = function(useStore) {
	    var result = (window.cti === undefined) ? undefined : window.cti;
	    if (!result) { return undefined; }
	    return (useStore) ? result.store : result;
	}

	//======================================================================================================================
	// Create a new guid. Obs.
	AppManager.prototype.newGuid = function() {
	  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString(16);
	  });  		
	}

    return AppManager;
}());

function setStatusBarColor() {
    if (!window.device) {
        return false;
    }
    StatusBar.show();
    StatusBar.styleLightContent();
    StatusBar.backgroundColorByHexString("#222e66");
}

function startAppServices() {
    console.log("Starting appManager");
    setStatusBarColor();
	
	window.application = new AppManager();
	setTimeout(window.application.pollingMonitor, 100);
}

if (!window.device) {
    console.log("No device, manually start appManager");
    window.setTimeout(function () {
		startAppServices();
    }, 100);
}

document.removeEventListener('deviceready', startAppServices);
document.addEventListener('deviceready', startAppServices, true);
