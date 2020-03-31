(function() {
  "use strict";

  angular.module('editorTest').directive('appEditor', function() {
    return {
      scope: {
        text: '='
      },
      restrict: 'E',
      templateUrl: '/editor/editor.html',
      link: function(scope, elem, attrs) {
        document.execCommand("defaultParagraphSeparator", false, "p");

        scope.modifyDoc = modifyDoc;
        scope.insertComment = insertComment;
        
        function modifyDoc(command, value) {
          document.execCommand(command, false, value)
        };

        function insertComment() {
          const selectedText = document.getSelection().toString();

          document.execCommand('insertHTML', false, `<mark>${selectedText}</mark>`);
        }
      }
    };
  });
})()