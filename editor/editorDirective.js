(function() {

  'use strict';

  angular.module('editorTest').directive('appEditor', [function() {
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
        const allowedEditorTags = ['p', 'mark'];
        
        // Shadow variable to run in parallel with the editor.innerHTML.
        // Represents the last known state of the editor element.
        // This will be updated by the debounced keyup handler on the editor element.
        let editorHTML;

        // Stacks used for undo/redo on the editorHTML.
        // undoStack is fed by the debounced keyup handler on the editor element
        // which will push the editorHTML value onto the stack.
        // redoStack will be pushed to by the undo function which pops the undoStack onto the redoStack.
        // redoStack is cleared by the debounced keyup handler on the editor element.
        let undoStack = [];
        let redoStack = [];

        // DOM handles
        const appEditor = elem[0];
        const toolbar = appEditor.querySelector('div.toolbar');
        const undoButton = toolbar.querySelector('button[aria-label="undo"]');
        const redoButton = toolbar.querySelector('button[aria-label="redo"]');
        const commentButton = toolbar.querySelector('button[aria-label="add comment"]');
        const heading = appEditor.querySelector('div.heading');
        const editorTitle = heading.querySelector('h5');
        const closeButton = heading.querySelector('button[aria-label="close"]');
        const editor = appEditor.querySelector('div[contenteditable]');
        
        // Initialize
        editorTitle.appendChild(document.createTextNode(scope.editorTitle));

        // Set text into editor element, sanitizing first.
        if (scope.text === '' || scope.text === '<p></p>' || scope.text === '<p><br></p>') {
          editorHTML = sanitizeHtml(DEFAULT_TEXT, { allowedTags: allowedEditorTags });
        } else {
          editorHTML = sanitizeHtml(scope.text, { allowedTags: allowedEditorTags });
        }

        editor.innerHTML = editorHTML;

        // Set event listeners for each element
        undoButton.addEventListener('click', undo);
        redoButton.addEventListener('click', redo);
        commentButton.addEventListener('click', insertComment);
        closeButton.addEventListener('click', closeEditor);
        editor.addEventListener('keydown', handleKeydown);
        editor.addEventListener('keyup', debounce(handleEditorHtmlChange, 200));
        editor.addEventListener('keyup', debounce(autosave, 3000));
        editor.addEventListener('paste', handlePaste);

        // Function definitions
        
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

        /**
         * Intercepts keydown events in the editor element to capture undo/redo shortcuts
         * @param {Event} evt 
         */
        function handleKeydown(evt) {
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            undo();
          } else if (evt.key === 'Z' && evt.shiftKey && evt.ctrlKey) {
            evt.preventDefault();
            redo();
          }
        }

        // Calls injected save function when user is idle for 3 seconds
        function autosave(evt) {
          // don't do anything for undo redo shortcuts
          // TODO: Verify that this is OK
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            return;
          } else if (evt.key === 'Z' && evt.ctrlKey && evt.shiftKey) {
            evt.preventDefault();
            return;
          }
          let value = editor.innerHTML;
          if (value === DEFAULT_TEXT || value === '<p></p>' || value === '<p><br></p>') value = '';
          scope.onsave({ value });
        }

        function handleEditorHtmlChange(evt) {
          // don't do anything for undo redo shortcuts
          // TODO: Verify that this is OK
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            return;
          } else if (evt.key === 'Z' && evt.ctrlKey && evt.shiftKey) {
            evt.preventDefault();
            return;
          }
          
          if (editor.innerHTML !== editorHTML) {
            // push the new value to the undo stack
            undoStack.push(editorHTML);
            editorHTML = sanitizeHtml(editor.innerHTML, allowedEditorTags);
            // since this is a new value, clear the redo stack
            redoStack = [];
          }
        }

        function handlePaste(evt) {
          const paste = (evt.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\n/g, '</p><p>');
          
          document.execCommand('insertHTML', false, paste);
          
          evt.preventDefault();
        }

        function undo() {
          if (undoStack.length > 0) {
            redoStack.push(editorHTML);
            editorHTML = undoStack.pop();
            editor.innerHTML = editorHTML;
          }
        }

        function redo() {
          if (redoStack.length > 0) {
            undoStack.push(editorHTML);
            editorHTML = redoStack.pop();
            editor.innerHTML = editorHTML;
          }
        }

        function insertComment() {
          
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

        function closeEditor() {
          console.error('closeEditor', 'implement');
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

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  function debounce(func, wait, immediate) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }
})();