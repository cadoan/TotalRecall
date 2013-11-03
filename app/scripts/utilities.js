define([], function () {
	'use strict';

	var Utilities = {};

	Utilities.addStyle = function(selector, rule){

		var stylesheet = document.styleSheets[0];

		if (stylesheet.insertRule) {
		    stylesheet.insertRule(selector + rule, 0);
		} else if (stylesheet.addRule) {
		    stylesheet.addRule(selector, rule, -1);
		}
	};


	return Utilities;
});