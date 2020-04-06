(function() {

  'use strict';

  angular.module('editorTest').directive('appEditor', ['$sce', function($sce) {
    return {
      scope: {
        text: '<?',
        onsave: '&',
        onsavecomment: '&',
        editorTitle: '@?'
      },
      templateUrl: '/editor/editor.html',
      link: function(scope, elem) {
        // Set all enter key presses to be new paragraphs
        document.execCommand('defaultParagraphSeparator', false, 'p');

        const DEFAULT_TEXT = '<p>Add text...</p>';
        const editor = elem[0].querySelector('div[contenteditable]');
        
        scope.showToolbar = false;
        scope.makingComment = false;
        
        scope.modifyDoc = modifyDoc;
        scope.insertComment = insertComment;
        scope.handleFocus = handleFocus;
        scope.handleBlur = handleBlur;
        scope.handleInput = handleInput;
        scope.handlePaste = handlePaste;
        
        if (scope.text === '' || scope.text === '<p></p>' || scope.text === '<p><br></p>') {
          scope.text = $sce.trustAsHtml(DEFAULT_TEXT);
        } else {
          scope.text = $sce.trustAsHtml(scope.text);
        }
        
        function modifyDoc(command, value) {
          document.execCommand(command, false, value);
        }
        
        function insertComment() {
          scope.showToolbar = true;
          
          const selection = document.getSelection();
          const selectionRange = selection.getRangeAt(0);
          const selectionBoundingRect = selectionRange.getBoundingClientRect();
          const selectedText = selection.toString();
          const commentId = Math.random().toString(36).substr(2, 9);
          
          // add a mark element to the text
          document.execCommand('insertHTML', false, `<mark data-id="${commentId}">${selectedText}</mark>`);
          
          const commentForm = createCommentForm(
            selectionBoundingRect.x + selectionBoundingRect.width / 2 - editor.offsetLeft,
            selectionBoundingRect.y - editor.offsetTop
          );
          editor.appendChild(commentForm);
          
          editor.addEventListener('save', saveComment);
          
          function saveComment(evt) {
            evt.stopImmediatePropagation();
            scope.onsavecomment({ commentId, commentText: evt.detail });
            editor.removeChild(document.querySelector('form.comment-form'));
            // remove this event handler so subsequent comments won't call this instance
            editor.removeEventListener('save', saveComment);
          }
          
          // event handlers for editor
          editor.addEventListener('cancel', cancelComment);
            
          function cancelComment(evt) {
            evt.stopImmediatePropagation();
            const textNode = document.createTextNode(selectedText);
            const mark = editor.querySelector(`mark[data-id="${commentId}"]`);
            mark.parentElement.replaceChild(textNode, mark);
            editor.removeChild(document.querySelector('form.comment-form'));
            // remove this event handler so subsequent comments won't call this instance
            editor.removeEventListener('cancel', cancelComment);
          }
        }
        
        function handleFocus() {
          scope.showToolbar = true;

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

  function createCommentForm(left, bottom) {
    const commentForm = document.createElement('form');
    commentForm.className='comment-form';
    commentForm.style.left = `${left}px`;
    commentForm.style.bottom = `calc(${bottom}px + 1.5em)`;
    commentForm.innerHTML = `<textarea name="comment" style="resize:none; width: 250px; height: 3em;" required></textarea>
      <button type="button" name="save" title="Save comment"><i class="fa fa-check" aria-hidden="true"></i></button>
      <button type="button" name="cancel" title="Cancel"><i class="fa fa-times" aria-hidden="true"></i></button>`;
    
    // trap all keyups inside commentForm except esc key
    commentForm.addEventListener('keyup', evt => {
      evt.stopPropagation();
      if (evt.key === 'Esc') cancel();
      if (evt.key === 'Enter') save();
    });

    const textarea = commentForm.querySelector('textarea');

    commentForm.querySelector('button[name="save"]').addEventListener('click', evt => {
      evt.stopImmediatePropagation();
      save();
    });

    commentForm.querySelector('button[name="cancel"]').addEventListener('click', evt => {
      evt.stopImmediatePropagation();
      cancel();
    });

    return commentForm;

    function save() {
      commentForm.dispatchEvent(new CustomEvent('save', { detail: textarea.value, bubbles: true }));
    }

    function cancel() {
      commentForm.dispatchEvent(new Event('cancel', { bubbles: true }));
    }
  }
})();