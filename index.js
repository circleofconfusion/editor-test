"use strict";
const module = angular.module('editorTest',['ngSanitize']);

module.controller('main', ['$sce', function($sce) {
  const model = this;

  model.txt1 = $sce.trustAsHtml('<p>foo</p>');
  model.txt2 = $sce.trustAsHtml('<p></p>');
  
  model.saveHandler = saveHandler;

  function saveHandler() {
    console.log('saveHandler', arguments)
  }
}]);