var extId = chrome.runtime.id;
var ctx = chrome.extension.getBackgroundPage();
var idx = 0;
var selectionPopup = null;

function log(msg) {
	ctx.console.info(msg);
}

function toggleElement(el) {
	if($(el).css('display') == "block") {
		$(el).css('display','none');
		return false;
	} else {
		$(el).css('display','block');
		return true;
	}
}

function initSelections(els) {
	$.each(els, function(idx, item) {
		$("#IS_selection_holder").append(
			$(document.createElement('li'))
				.append(item.innerHtml)
		);
	});
}

function initConfig() {
	toggleElement($("#IS_step_portions"));
	toggleElement($("#IS_step_config"));
	
	$("#IS_config_iterate_url").val(ctx.manifest.url);
}

function setLabel() {	
	var applyLabel = $(".IS_template_" + selectionPopup.attr('rel'));
	applyLabel.attr('id',"IS_start_" + $(selectionPopup.find('input')[0]).val());
	toggleElement(selectionPopup);
}

function parseSelectedPortion() {
	var selection = window.getSelection();
	var range = selection.getRangeAt(0);
	var html = selection.anchorNode.parentElement;
	
	var s = html.innerHTML.substring(0, range.startOffset);
	var e = html.innerHTML.substring(range.endOffset, html.length);
	var t = selection.toString();
	
	$(html).html(s + '<span class="IS_label IS_template_' + idx + '">' + t + "</span>" + e);
	
	var label = $(".IS_template_" + idx);
	
	toggleElement(selectionPopup);
	$(selectionPopup.find('input')[0]).val('');
	selectionPopup.attr('rel', idx);
	selectionPopup.css({
		'top' : label.position().top - (selectionPopup.height() + 10),
		'left' : label.position().left
	});
	
	idx++;
}

function finishPortions() {
	$.ajax({
		url: "/layout/selection_view.html",
		dataType: "html",
		success: function(html) {			
			$.each($("#IS_selection_holder").children('li'), function(i, item) {				
				var template = $(html).clone();
				$(template).append($(item).html());
				
				var templateHolder = $(document.createElement('div'));
				$(templateHolder).append($(template));
				
				ctx.manifest.elements[i].innerHtml = $(templateHolder).html();				
			});

			initConfig();
		}
	});
}

function finishSchema() {
	$.each($(".IS_config_form").find('input,select,textarea'), function(i, item) {
		log($(item));
		
		var value = null;
		var tag = $(item).attr('id');
		
		switch($(item).prop('tagName').toLowerCase()) {
		case "input":
			if($(item).val() != 0 && $(item).val() != '') {
				value = $(item).val();
			}
			break;
		case "select":
			value = $($(item).children('option:selected')[0]).val();
			break;
		case "textarea":
			if($(item).val().length > 1) {
				value = $(item).val();
			}
			break;
		}
		
		if(tag != null && value != null) {
			ctx.manifest.config[tag] = value;
		}
	});
	
	log(ctx.manifest.config);
	
	port.postMessage({
		sender: "uiPanel",
		data: "schemaPrepared"
	});
}

function loadAsset(el, val) {
	log($(el).prop('tagName'));
}

port = chrome.runtime.connect(extId, {name: "uiPanel"});
port.onMessage.addListener(function(message) {
	log("forground received");
	log(message);
	
	if(message.sender == extId) {
		if(message.data == "portionSelected") {
			parseSelectedPortion();
		}
		
		if(message.data == "loadAsset") {
			loadAsset($("#" + message.asset.id), message.asset.value);
		}
		
		if(message.data == "connectionEstablished") {
			if(message.initData == null) {
				initSelections(ctx.manifest.elements);
			} else {
				// load all this data
			}
		}
	}
});

$(document).ready(function() {
	selectionPopup = $("#IS_selection_popup");
	
	$("#IS_label_setter").on('click', setLabel);
	
	$("#IS_submit_portions").on('click', finishPortions);
	$("#IS_submit_config").on('click', finishSchema);
		
	port.postMessage({
		sender: "uiPanel",
		data: "connectionEstablished"
	});
});