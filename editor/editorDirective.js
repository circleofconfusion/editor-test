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
        // Set all enter key presses to be new paragraphs
        document.execCommand("defaultParagraphSeparator", false, "p");

        const editDiv = elem[0].querySelector('div[contentEditable="true"]');

        editDiv.addEventListener('paste', evt => {
          const text = (evt.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\n/g, '</p><p>');

          document.execCommand('insertHTML', false, text);

          evt.preventDefault();
        });

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