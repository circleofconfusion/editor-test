(function() {

  'use strict';

  angular.module('editorTest').directive('appEditor', ['$sce', function($sce) {
    return {
      scope: {
        text: '<?',
        onsave: '&'
      },
      templateUrl: '/editor/editor.html',
      link: function(scope, elem, attrs) {
        // Set all enter key presses to be new paragraphs
        document.execCommand('defaultParagraphSeparator', false, 'p');

        const DEFAULT_TEXT = '<p>Add text...</p>';
        const editor = elem[0].querySelector('div[contenteditable]');

        console.log(scope.text);
        if (scope.text === '' || scope.text === '<p></p>' || scope.text === '<p><br></p>') {
          scope.text = $sce.trustAsHtml(DEFAULT_TEXT);
        } else {
          scope.text = $sce.trustAsHtml(scope.text);
        }

        scope.modifyDoc = modifyDoc;
        scope.insertComment = insertComment;
        scope.handleFocus = handleFocus;
        scope.handleBlur = handleBlur;
        scope.handleInput = handleInput;
        scope.handlePaste = handlePaste;

        function modifyDoc(command, value) {
          document.execCommand(command, false, value);
        }

        function insertComment() {
          const selectedText = document.getSelection().toString();
          const commentId = Math.random().toString(36).substr(2, 9);
          document.execCommand('insertHTML', false, `<mark data-id="${commentId}">${selectedText}</mark>`);
        }

        function handleFocus() {
          if (editor.innerHTML === DEFAULT_TEXT) {
            editor.innerHTML = '';
            document.execCommand('insertHtml', false, '<p></p>');
          }
        }

        function handleBlur() {
          if (editor.innerHTML === '' || editor.innerHTML === '<p></p>' || editor.innerHTML === '<p><br></p>') {
            editor.innerHTML = DEFAULT_TEXT;
          }
        }

        // calls injected save function when user is idle for 3 seconds
        let timeoutHandle;
        function handleInput() {
          clearTimeout(timeoutHandle);
          timeoutHandle = setTimeout(() => {
            let value = editor.innerHTML;
            if (value === DEFAULT_TEXT || value === '<p></p>' || value === '<p><br></p>') value = '';
            scope.onsave({ value });
          }, 3000);
        }

        function handlePaste(evt) {
          const paste = (event.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\n/g, '</p><p>');

          document.execCommand('insertHTML', false, paste);
          
          evt.preventDefault();
        }
      }
    };
  }]);
})();