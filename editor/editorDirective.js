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

        // private properties
        const DEFAULT_TEXT = '<p>Add text...</p>';
        const editor = elem[0].querySelector('div[contenteditable]');
        
        // public properties
        scope.showToolbar = false;
        scope.undoStack = [];
        scope.redoStack = [];
        
        // public functions
        scope.modifyDoc = modifyDoc;
        scope.insertComment = insertComment;
        scope.handleFocus = handleFocus;
        scope.handleBlur = handleBlur;
        scope.handleKeydown = handleKeydown;
        scope.handleKeyup = handleKeyup;
        scope.handlePaste = handlePaste;
        scope.undo = undo;
        scope.redo = redo;
        
        // Initialize
        if (scope.text === '' || scope.text === '<p></p>' || scope.text === '<p><br></p>') {
          scope.text = $sce.trustAsHtml(DEFAULT_TEXT);
        } else {
          scope.text = $sce.trustAsHtml(scope.text);
        }

        scope.undoStack.push(scope.text);

        editor.addEventListener('keydown', handleKeydown);
        editor.addEventListener('keyup', handleKeyup);

        // Function definitions
        function modifyDoc(command, value) {
          document.execCommand(command, false, value);
        }
        
        function insertComment() {
          makingComment = true;
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
          commentForm.querySelector('textarea').focus();
          
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

        function handleKeydown(evt) {
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            undo();
          } else if (evt.key === 'Z' && evt.shiftKey && evt.ctrlKey) {
            evt.preventDefault();
            redo();
          }
        }

        let saveTimeoutHandle;
        let undoTimeoutHandle;
        // Calls injected save function when user is idle for 3 seconds
        function handleKeyup(evt) {
          // don't do anything for undo redo shortcuts
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            return;
          } else if (evt.key === 'Z' && evt.ctrlKey && evt.shiftKey) {
            evt.preventDefault();
            return;
          }

          // Clear timeout on autosaving of data.
          clearTimeout(saveTimeoutHandle);
          // Start the autosave clock. If it gets to 3 seconds, execute the onsave function.
          saveTimeoutHandle = setTimeout(() => {
            let value = editor.innerHTML;
            if (value === DEFAULT_TEXT || value === '<p></p>' || value === '<p><br></p>') value = '';
            scope.onsave({ value });
          }, 3000);

          // Clear timeout on pushing to the undo stack.
          clearTimeout(undoTimeoutHandle);
          // Start the undo stack pushing timeout.
          undoTimeoutHandle = setTimeout(() => {
            let value = editor.innerHTML;
            if (value !== scope.undoStack[scope.undoStack.length - 1]) {
              // push the new value to the undo stack
              scope.undoStack.push(value);
              // since this is a new value, clear the redo stack
              scope.redoStack = [];
            }
          }, 300);
        }

        function handlePaste(evt) {
          const paste = (evt.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\n/g, '</p><p>');

          document.execCommand('insertHTML', false, paste);
          
          evt.preventDefault();
        }

        function undo() {
          console.log('undo', scope.undoStack);
          if (scope.undoStack.length > 1) {
            scope.redoStack.push(scope.undoStack.pop());
            editor.innerHTML = scope.undoStack[scope.undoStack.length - 1];
          }
        }

        // FIXME: scope is only being applied after save function updates scope.text via the binding
        // FIXME: ctrl z causes weird behavior - loses stack somehow

        function redo() {
          console.log('redo', scope.redoStack)
          if (scope.redoStack.length > 0) {
            const redoValue = scope.redoStack.pop();
            scope.undoStack.push(redoValue);
            editor.innerHTML = redoValue;
          }
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
    
    // trap all keyups inside commentForm
    commentForm.addEventListener('keyup', evt => {
      evt.stopPropagation();
    });

    // Special key handlers
    commentForm.addEventListener('keydown', evt => {
      // Save the comment if enter key is pressed.
      // If shift key is held while pressing enter, start a newline.
      if (evt.key === 'Enter' && !evt.shiftKey) {
        evt.preventDefault();
        save();
      }

      // If escape key is pressed, cancel submission.
      if (evt.key === 'Escape') {
        cancel();
      }
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