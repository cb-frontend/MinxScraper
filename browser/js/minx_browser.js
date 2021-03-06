console.info(API_PORT);

var domId = null;
var manifest = {
	elements: [],
	config: {}
};
var panelId = null;
var port = null;
var extId = chrome.runtime.id;
var webRequestOpts = {
	onSendHeaders : {
		infoSpec : [
			'requestHeaders'
		]
	},
	onCompleted: {
		infoSpec : [
			'responseHeaders'
		]
	},
	filter : {
		urls: ["<all_urls>"]
	}
}

var contextMenus = {
	domutil: {
		id: 'IS_select_elements',
		callback: function() {
			loadDomUtil();
		}
	},
	labeler : {
		id: 'IS_label_portion',
		callback: function() {
			port.postMessage({sender: extId, data: "portionSelected"});
		}
	},
	fuzzer : {
		id: 'IS_fuzz_portion',
		callback: function() {
			port.postMessage({sender: extId, data: "fuzzSelected"});
		}
	},
	iterate_url : {
		id: 'IS_iterate_portion',
		callback: function() {
			port.postMessage({sender: extId, data: "iterateOverURL"});
		}
	}
};

function escapeHtml(html) {	
	html = html.replace(/&lt;/g, "<");
	html = html.replace(/&gt;/g, ">");
	//html = html.replace(/\t/g, "");
	//html = html.replace(/\n/g, "");

	return html;
}

function loadDomUtil() {
	chrome.tabs.sendMessage(domId, {
		sender: extId,
		data: "initDomUtil",
		contentType : manifest.contentType
	});
}

function loadScraperPanel() {	
	chrome.windows.create(
		{
			'url' : '/layout/minx_browser.html',
			'type' : 'panel'
		},
		function(window) {
			panelId = window.id;
		}
	);
}

function initScraper(tab) {
	manifest = {
		elements: [],
		config: {},
		url: tab.url
	};
	
	domId = tab.id;
	chrome.tabs.reload();
	
	chrome.tabs.executeScript(domId, {file: "/js/dom_utils.js"});
	initOptions();
}

function initOptions() {
	removeMenuOptions(contextMenus.domutil.id);
	
	chrome.contextMenus.create({
		'title' : "Create MinxScraper from this element...",
		'id' : contextMenus.domutil.id,
		'contexts' : ["selection"],
		'onclick' : contextMenus.domutil.callback
	});
}

function initLabeler() {
	removeMenuOptions([contextMenus.labeler.id, contextMenus.fuzzer.id]);
	
	chrome.contextMenus.create({
		'title' : "Label this portion as...",
		'id' : contextMenus.labeler.id,
		'contexts' : ["selection"],
		'onclick' : contextMenus.labeler.callback
	});
	
	chrome.contextMenus.create({
		'title' : "Fuzz this selection",
		'id' : contextMenus.fuzzer.id,
		'contexts' : ["selection"],
		'onclick' : contextMenus.fuzzer.callback
	});
}

function initConfiger() {
	removeMenuOptions();
	
	chrome.contextMenus.create({
		'title' : "Iterate over this URL...",
		'id' : contextMenus.iterate_url.id,
		'contexts' : ["selection"],
		'onclick' : contextMenus.iterate_url.callback
	});
}

function removeMenuOption(id) {
	chrome.contextMenus.remove(id);
}

function removeMenuOptions(id) {
	if(id != undefined) {
		if(typeof id === 'string') {
			id = [id];
		}		
	}
	
	for(cm in contextMenus) {
		var contextMenu = contextMenus[cm];
		
		if(id != undefined && id.indexOf(contextMenu.id) != -1) {
			continue;
		}
		
		removeMenuOption(contextMenu.id);
	}
}

function packageManifest() {
	var post = { manifest : manifest };
	console.info(JSON.stringify(post));
	
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "http://localhost:" + API_PORT, true);
	xhr.setRequestHeader("Content-type", "application/json");
	
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4) {
			console.info(JSON.parse(xhr.responseText));
		}
	};
	
	xhr.send(JSON.stringify(post));
}

function testSchema() {
	var post = { manifest : manifest };
	post.manifest['confirm'] = true;
	
	console.info(post);
	

	var xhr = new XMLHttpRequest();
	xhr.open("POST", "http://localhost:" + API_PORT, true);
	xhr.setRequestHeader("Content-type", "application/json");
	xhr.onreadystatechange = function() {
		if(xhr.readyState == 4) {
			var readout = "";
			var r = JSON.parse(xhr.responseText);
			if(r.matches > 0) {
				for(var d=0; d < r.data.length; d++) {
					for(key in r.data[d]) {
						readout += (
							'<span class="IS_label">' + 
							key + ":</span> " + 
							r.data[d][key]);
					}
				}
			} else {
				readout = "No results from this scrape.";
			}
			
			port.postMessage({
				sender: extId,
				data: "confirmTest",
				readout: readout
			});
		}
	};
	
	xhr.send(JSON.stringify(post));
	
}

function initUiPanelData() {
	return null;
}

chrome.webRequest.onCompleted.addListener(
	function(details) {
		if(domId != null) {
		
			if(details.tabId != undefined && details.tabId == domId) {
				if(details.url == manifest.url) {
					console.info(details);
					
					for(var i=0, h; h=details.responseHeaders[i]; i++) {
						if(h.name == "Content-Type") {
							manifest.contentType = h.value;
							break;
						}
					}
				}
			}
		}
		
		return true;
	},
	webRequestOpts.filter,
	webRequestOpts.onCompleted.infoSpec
);

chrome.webRequest.onSendHeaders.addListener(
	function(details) {
		if(domId != null) {
			if(details.tabId != undefined && details.tabId == domId) {
				if(details.url == manifest.url) {
					console.info(details);
					
					manifest.headers = details.requestHeaders;
					manifest.method = details.method;
				}
			}
		}
		
		return true;
	},
	webRequestOpts.filter,
	webRequestOpts.onSendHeaders.infoSpec
);

chrome.tabs.onActivated.addListener(function(tab) {
	console.info("tab changed!");
	domId = tab.tabId;
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if(message.sender == "domUtils") {
		if(message.data == "setElements") {
			initLabeler();
			manifest.elements = message.elements;
			manifest.rootElement = message.rootElement;
			
			loadScraperPanel();
		}
		
		if(message.data == "schemaPreparedWithXML") {
			for(var e=0, xml; xml = message.pathToXMLRoot[e]; e++) {
				manifest.elements[xml.domIndex].xmlPath = xml.tags;
				manifest.elements[xml.domIndex].xmlContent = escapeHtml(xml.XMLContent);
			}

			testSchema();
		}
	}
	
	console.info("background received");
	console.info(message);
	console.info(sender);		
});

chrome.runtime.onConnect.addListener(function(p) {
	port = p;
	
	port.onMessage.addListener(function(message) {
		console.info("background received");
		console.info(message);
		
		if(message.sender == "uiPanel") {
			if(message.data == "schemaPrepared") {
				console.info(manifest.elements);
				chrome.windows.remove(panelId);
				
				/*
				if(manifest.contentType == "text/xml") {
					manifest.rootElement = "rss";
					chrome.tabs.sendMessage(domId, {
						sender: extId,
						data: "getPathToXMLRoot",
						elements: manifest.elements
					});
				} else {			
					packageManifest();
				}
				*/
				packageManifest();
			}
			
			if(message.data == "initConfiger") {
				initConfiger();
			}
			
			if(message.data == "connectionEstablished") {
				port.postMessage({
					sender: extId,
					data: "connectionEstablished",
					initData: initUiPanelData()
				});
			}
			
			if(message.data == "testSchema") {
				if(manifest.contentType == "text/xml") {
					manifest.rootElement = "rss";
					chrome.tabs.sendMessage(domId, {
						sender: extId,
						data: "getPathToXMLRoot",
						elements: manifest.elements
					});
				} else {
					testSchema();
				}
			}
		}
	});	
});

chrome.browserAction.onClicked.addListener(function(tab) {
	initScraper(tab);
});

chrome.windows.onRemoved.addListener(function(windowId) {
	initOptions();
});
