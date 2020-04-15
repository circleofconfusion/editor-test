'use strict';
angular.module('editorTest',['ngSanitize'])
  .controller('main', [ '$scope', function($scope) {
    const model = this;

    model.highlightedComments = [];
    model.data = [
      {
        text: '',
        comments: []
      },
      {
        text: '',
        comments: []
      }
    ];
    
    model.saveHandler = saveHandler;
    model.commentHandler = commentHandler;
    model.highlightComment = highlightComment;

    function saveHandler(index, text) {
      model.data[index].text = text;
      console.log(model.data);
    }

    function commentHandler(index, commentId, commentText) {
      model.data[index].comments.push({ markId: commentId, commentText});
      $scope.$apply();
      console.log(model.data);
    }

    function highlightComment(index, commentId) {
      if (model.highlightedComments[index] !== commentId) model.highlightedComments[index] = commentId;
      else model.highlightedComments[index] = undefined;
    }
  }]);