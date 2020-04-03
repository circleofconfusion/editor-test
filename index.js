'use strict';
angular.module('editorTest',['ngSanitize'])
  .controller('main', [ function() {
    const model = this;

    model.txt1 = '<p>foo</p>';
    model.txt2 = '';
    
    model.saveHandler = saveHandler;
    model.commentHandler = commentHandler;

    function saveHandler() {
      console.log('saveHandler', arguments);
    }

    function commentHandler() {
      console.log('commentHandler', arguments);
    }
  }]);