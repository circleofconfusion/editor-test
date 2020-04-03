(function() {

  'use strict';

  angular.module('editorTest').directive('appEditor', ['$sce', '$compile', function($sce, $compile) {
    return {
      scope: {
        text: '<?',
        onsave: '&',
        onsavecomment: '&'
      },
      templateUrl: '/editor/editor.html',
      link: function(scope, elem) {
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
          const selection = document.getSelection();
          const selectionRange = selection.getRangeAt(0);
          const selectionBoundingRect = selectionRange.getBoundingClientRect();
          const selectedText = selection.toString();
          const commentId = Math.random().toString(36).substr(2, 9);
          
          // add a mark element to the text
          document.execCommand('insertHTML', false, `<mark data-id="${commentId}">${selectedText}</mark>`);
          const mark = document.querySelector(`mark[data-id="${commentId}"]`);
          
          const commentForm = document.createElement('form');
          commentForm.className='comment-form';
          commentForm.style.left = `${selectionBoundingRect.x + selectionBoundingRect.width / 2 - editor.offsetLeft}px`;
          commentForm.style.bottom = `calc(${selectionBoundingRect.y - editor.offsetTop}px + 1.5em)`;
          commentForm.innerHTML = '<textarea name="comment" style="resize:none; width: 250px; height: 3em;" required></textarea>';
          commentForm.addEventListener('keyup', evt => evt.stopImmediatePropagation());
          
          const saveButton = document.createElement('button');
          saveButton.type = 'button';
          saveButton.title = 'Save comment';
          saveButton.innerHTML = '<i class="fa fa-check" aria-hidden="true"></i>';
          saveButton.addEventListener('click', () => {
            scope.onsavecomment({ commentId, commentText: commentForm.comment.value });
            editor.removeChild(commentForm);
            editor.setSelectionRange(selectionRange.startOffset, selectionRange.endOffset);
            document.execCommand('insertHTML', false, `<mark data-id="${commentId}">${selectedText}</mark>`);
          });
          commentForm.appendChild(saveButton);
          
          const cancelButton = document.createElement('button');
          cancelButton.type = 'button';
          cancelButton.title = 'Cancel';
          cancelButton.innerHTML = '<i class="fa fa-times" aria-hidden="true"></i>';
          cancelButton.addEventListener('click', () => {
            editor.removeChild(commentForm);
            const textNode = document.createTextNode(selectedText);
            mark.parentElement.replaceChild(textNode, mark);
          });
          commentForm.appendChild(cancelButton);
          
          editor.appendChild(commentForm);

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
          const paste = (evt.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\n/g, '</p><p>');

          document.execCommand('insertHTML', false, paste);
          
          evt.preventDefault();
        }
      }
    };
  }]);
})();