'use strict';
angular.module('editorTest',['ngSanitize'])
  .controller('main', [ '$scope', function($scope) {
    const model = this;

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
    model.deleteCommentHandler = deleteCommentHandler;

    function saveHandler(index, text) {
      model.data[index].text = text;
    }

    function commentHandler(index, commentId, commentText) {
      model.data[index].comments.push({ markId: commentId, commentText});
      $scope.$apply();
    }

    function highlightComment(commentId, highlight) {
      $scope.$broadcast('highlightComment', { commentId, highlight });
    }

    function deleteCommentHandler(index, commentId) {
      const commentIndex = model.data[index].comments.findIndex(c => c.commentId === commentId);
      model.data[index].comments.splice(commentIndex, 1);
      $scope.$broadcast('deleteComment', { commentId });
    } 
  }]);