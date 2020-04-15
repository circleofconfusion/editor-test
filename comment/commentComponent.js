(function() {
  angular.module('editorTest').component('appComment', {
    bindings: {
      commentData: '<',
      highlight: '&?',
      update: '&?',
      delete: '&?'
    },
    templateUrl: '/comment/comment.html',
    controllerAs: 'model',
    controller: ['$scope', function($scope) {
      const model = this;

      model.editing = false;
      model.highlighted = false;
      const commentId = model.commentData.markId;
      model.commentText = model.commentData.commentText;
      model.commentEditedText = model.commentData.commentText;

      if (model.highlight) model.onHighlight = onHighlight;
      if (model.update) model.onSaveEdit = onSaveEdit;
      if (model.delete) model.onDelete = onDelete;

      $scope.$on('highlightComment', (evt, args) => {
        if (args.commentId !== commentId) {
          model.highlighted = false;
        }
      });

      function onToggleEdit() {
        model.editing = !model.editing;
        if (!model.editing) model.commentEditedText = model.commentData.commentText;
      }

      function onHighlight() {
        model.highlighted = !model.highlighted;
        model.highlight({ commentId, highlight: model.highlighted });
      }

      function onSaveEdit() {
        model.update({ commentId, commentText: model.commentText });
      }

      function onDelete() {
        model.delete({ commentId });
      }
    }]
  });
})();