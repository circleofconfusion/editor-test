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
    controller: function() {
      const model = this;

      model.editing = false;
      const commentId = model.commentData.markId;
      model.commentText = model.commentData.commentText;
      model.commentEditedText = model.commentData.commentText;

      if (model.highlight) model.onHighlight = onHighlight;
      if (model.update) model.onSaveEdit = onSaveEdit;
      if (model.delete) model.onDelete = onDelete;

      function onToggleEdit() {
        model.editing = !model.editing;
        if (!model.editing) model.commentEditedText = model.commentData.commentText;
      }

      function onHighlight() {
        model.highlight({ commentId });
      }

      function onSaveEdit() {
        model.update({ commentId, commentText: model.commentText });
      }

      function onDelete() {
        model.delete({ commentId });
      }
    }
  });
})();