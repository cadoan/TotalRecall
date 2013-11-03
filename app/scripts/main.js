require.config({
	paths: {
        jquery: '../bower_components/jquery/jquery'
    }
});

require(['totalRecallApp'], function (totalRecallApp) {
    'use strict';
   
	totalRecallApp.init();
   
});
