(function() {

  'use strict';

  angular.module('editorTest').directive('appEditor', [function() {
    return {
      scope: {
        text: '<?',
        onsave: '&',
        onsavecomment: '&',
        editorTitle: '@?',
        closeable: '<?',
        highlightedComment: '<?',
        deletedComment: '<?'
      },
      templateUrl: '/editor/editor.html',
      link: function(scope, elem, attrs) {
        // Set all enter key presses to be new paragraphs
        document.execCommand('defaultParagraphSeparator', false, 'p');

        //=====================================================================
        // Variable Declarations
        //=====================================================================

        const DEFAULT_TEXT = '<p>Add text...</p>';
        const allowedEditorTags = ['p', 'mark'];
        const allowedAttributes = {
          'mark': [ 'data-id' ]
        };
        
        // Shadow variable to run in parallel with the editor.innerHTML.
        // Represents the last known state of the editor element.
        // This will be updated by the debounced keyup handler on the editor element.
        let editorHTML;

        // Stacks used for undo/redo on the editorHTML.
        let undoStack = [];
        let redoStack = [];

        // DOM handles
        const appEditor = elem[0], // the <app-editor> root tag
          toolbar = appEditor.querySelector('div.toolbar'), 
          undoButton = toolbar.querySelector('button[aria-label="undo"]'),
          redoButton = toolbar.querySelector('button[aria-label="redo"]'),
          commentButton = toolbar.querySelector('button[aria-label="add comment"]'),
          heading = appEditor.querySelector('div.heading'),
          editorTitle = heading.querySelector('h5'),
          closeButton = heading.querySelector('button[aria-label="close"]'),
          editor = appEditor.querySelector('div[contenteditable]'),
          commentForm = appEditor.querySelector('form.comment-form'),
          commentTextarea = commentForm.querySelector('textarea'),
          saveCommentButton = commentForm.querySelector('button[aria-label="save comment"]'),
          cancelCommentButton = commentForm.querySelector('button[aria-label="cancel comment"]');
        
        //=====================================================================
        // Initialize
        //=====================================================================

        editorTitle.appendChild(document.createTextNode(scope.editorTitle));

        // Set text into editor element, sanitizing first.
        if (scope.text === '' || scope.text === '<p></p>' || scope.text === '<p><br></p>') {
          editorHTML = sanitizeHtml(DEFAULT_TEXT, { allowedTags: allowedEditorTags, allowedAttributes });
        } else {
          editorHTML = sanitizeHtml(scope.text, { allowedTags: allowedEditorTags, allowedAttributes });
        }
        
        editor.innerHTML = editorHTML;

        if (scope.closeable !== true) {
          closeButton.style.display = 'none';
        }

        // watch the incoming highlightedComment and deletedComment properties and react as necessary
        scope.$watch('highlightedComment', (commentId, oldCommentId) => {
          if (commentId === undefined) {
            Array.from(editor.querySelectorAll('mark.highlight')).forEach(m => m.classList.remove('highlight'));
            return;
          }

          const oldMark = editor.querySelector(`mark[data-id="${oldCommentId}"]`);
          const newMark = editor.querySelector(`mark[data-id="${commentId}"]`);
          if (oldMark) oldMark.classList.toggle('highlight');
          if (newMark) newMark.classList.toggle('highlight');
        });
        
        //=====================================================================
        // Event Listeners
        //=====================================================================

        appEditor.addEventListener('focusout', refreshUi);
        undoButton.addEventListener('click', undo);
        redoButton.addEventListener('click', redo);
        commentButton.addEventListener('click', insertComment);
        closeButton.addEventListener('click', closeEditor);
        editor.addEventListener('focusin', editorFocus);
        editor.addEventListener('blur', editorBlur);
        appEditor.addEventListener('keydown', handleKeydown);
        editor.addEventListener('keyup', debounce(handleEditorHtmlChange, 200));
        editor.addEventListener('keyup', debounce(autosave, 3000));
        editor.addEventListener('mouseup', debounce(refreshUi, 200));
        editor.addEventListener('paste', handlePaste);
        commentForm.addEventListener('keydown', commentFormSpecialKeys);
        saveCommentButton.addEventListener('click', saveComment);
        cancelCommentButton.addEventListener('click', cancelComment);

        //=====================================================================
        // Function definitions
        //=====================================================================

        /**
         * Updates the user interface to reflect internal data.
         * Affects:
         *  - show/hide toolbar
         *  - enable/disable undo/redo buttons
         *  - enable/disable comment button
         */
        function refreshUi() {
          // enable/disable undo button
          if (undoStack.length > 0) undoButton.disabled = false;
          else undoButton.disabled = true;

          // enable/disable redo button
          if (redoStack.length > 0) redoButton.disabled = false;
          else redoButton.disabled = true;

          // show/hide toolbar
          // Wait 50ms so that whatever got clicked on outside of the editor
          // has time to receive focus.
          setTimeout(() => {
            const children = Array.from(appEditor.querySelectorAll('*'));
            const activeElement = document.activeElement;
            if (!children.includes(activeElement))
              toolbar.style.visibility = 'hidden';
          }, 50);

          // enable/disable comment button
          commentButton.disabled = !commentEnabled();
        }

        /**
         * When editor is focused, swaps out default text for an empty paragraph.
         */
        function editorFocus() {
          toolbar.style.visibility = 'visible';

          if (editor.innerHTML === DEFAULT_TEXT) {
            const paragraph = editor.querySelector('p');
            const selection = document.getSelection();
            selection.selectAllChildren(paragraph);
          }

          refreshUi();
        }

        /**
         * When focus is lost, checks for empty(ish) editor.innerHTML and replaces it with the default text.
         */
        function editorBlur() {
          if (editor.innerHTML === '' || editor.innerHTML === '<p></p>' || editor.innerHTML === '<p><br></p>') {
            editor.innerHTML = DEFAULT_TEXT;
          }
        }

        /**
         * Intercepts keydown events anywhere inside the app-editor element to capture undo/redo shortcuts
         * @param {Event} evt 
         */
        function handleKeydown(evt) {
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            undo();
          } else if (evt.key === 'Z' && evt.shiftKey && evt.ctrlKey) {
            evt.preventDefault();
            redo();
          } else if (evt.key === 'k' && evt.ctrlKey && commentEnabled()) {
            evt.preventDefault();
            insertComment();
          } else if ((evt.key === 'Delete' || evt.key === 'Backspace') && (editor.innerHTML === '<p></p>' || editor.innerHTML === '<p><br></p>')) {
            evt.preventDefault();
          }
        }

        /**
         * Calls injected save function when user is idle for 3 seconds.
         */
        function autosave(evt) {
          // don't do anything for undo redo shortcuts
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            return;
          } else if (evt.key === 'Z' && evt.ctrlKey && evt.shiftKey) {
            evt.preventDefault();
            return;
          }
          let value = sanitizeHtml(editor.innerHTML, { allowedTags: allowedEditorTags, allowedAttributes });
          if (value === DEFAULT_TEXT || value === '<p></p>' || value === '<p><br></p>') value = '';
          scope.onsave({ value });
        }

        /**
         * Adds a change to the undoStack after a period of inactivity.
         * @param {Event} evt Keyup event
         */
        function handleEditorHtmlChange(evt) {
          // don't do anything for undo redo shortcuts
          if (evt.key === 'z' && evt.ctrlKey) {
            evt.preventDefault();
            return;
          } else if (evt.key === 'Z' && evt.ctrlKey && evt.shiftKey) {
            evt.preventDefault();
            return;
          }
          
          addUndoItem();
          refreshUi();
        }

        // TODO: Test this with MS Word 😀😀😀😀😀
        /**
         * Tweaks incoming text pasted into the editor.
         * @param {Event} evt The paste event.
         */
        function handlePaste(evt) {
          const paste = (evt.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\n/g, '</p><p>');
          
          document.execCommand('insertHTML', false, paste);
          
          evt.preventDefault();
          refreshUi();
        }

        /**
         * Adds a text/html change to the undo history.
         */
        function addUndoItem() {
          if (editor.innerHTML !== editorHTML) {
            // push the new value to the undo stack
            undoStack.push(editorHTML);
            editorHTML = sanitizeHtml(editor.innerHTML, { allowedTags: allowedEditorTags, allowedAttributes });
            // since this is a new value, clear the redo stack
            redoStack = [];
          }
        }

        /**
         * Undoes a change in the editor.
         */
        function undo() {
          if (undoStack.length > 0) {
            redoStack.push(editorHTML);
            editorHTML = undoStack.pop();
            editor.innerHTML = editorHTML;
          }
          hideCommentForm();
          refreshUi();
        }

        /**
         * Redoes a previously undone change in the editor.
         */
        function redo() {
          if (redoStack.length > 0) {
            undoStack.push(editorHTML);
            editorHTML = redoStack.pop();
            editor.innerHTML = editorHTML;
          }
          refreshUi();
        }

        /**
         * Determines if the user is able to make a comment in the editor.
         * There must be a selection inside the editor element, and it must be at least one character long.
         */
        function commentEnabled() {
          const selection = document.getSelection();
          const selectionRange = selection.getRangeAt(0);
          return selection.anchorNode.parentElement.offsetParent === appEditor && selectionRange.startOffset < selectionRange.endOffset;
        }


        /**
         * Adds a mark element around the current selection, and opens/initializes the comment form.
         */
        function insertComment() {
          const selection = document.getSelection();
          const range = selection.getRangeAt(0);
          const selectionBoundingRect = range.getBoundingClientRect();
          const commentId = Math.random().toString(36).substr(2, 9);
          
          // add a mark element to the text
          const mark = document.createElement('mark');
          mark.setAttribute('data-id', commentId);
          // Unfortunately can't use selection.toString() because Safari is behind the times as usual.
          mark.appendChild(document.createTextNode(selection.getRangeAt(0).extractContents().textContent));
          
          range.deleteContents();
          range.insertNode(mark);

          // need to do this before any other action so commentForm has offset dimensions > 0
          commentForm.style.display = 'grid';

          const left = selectionBoundingRect.x + selectionBoundingRect.width / 2 - appEditor.offsetLeft;
          const top = selectionBoundingRect.y - appEditor.offsetTop - commentForm.offsetHeight;
          
          commentForm.commentId.value = commentId;
          // TODO: make the positioning of the comment form a bit smarter to handle odd scrolling situations
          // TODO: add triangle element that points to selection
          commentForm.style.left = `${left}px`;
          commentForm.style.top = `${top}px`;
          commentTextarea.focus();
        }

        /**
         * Resets and hides the comment form.
         */
        function hideCommentForm() {
          commentForm.reset();
          commentForm.style.display = 'none';
        }

        /**
         * Captures keydown events and if the keydown is enter or escape, saves or cancels the comment.
         * @param {Event} evt 
         */
        function commentFormSpecialKeys(evt) {
          evt.stopPropagation();

          // If enter key is pressed without the shift key, submit comment.
          if (evt.key === 'Enter' && !evt.shiftKey) {
            evt.preventDefault();
            saveComment();
          }

          // If escape key is pressed, cancel submission.
          if (evt.key === 'Escape') {
            cancelComment();
          }
        }

        /**
         * Calls an injected onsavecomment function, passing the commentId and comment text.
         */
        function saveComment() {
          if (!commentForm.comment.value) return;

          scope.onsavecomment({
            commentId: commentForm.commentId.value,
            commentText: commentForm.comment.value
          });
          addUndoItem();
          hideCommentForm();
          refreshUi();
        }
         
        /**
         * Closes/resets the comment form.
         * Removes the <mark> tag from the editor.
         */
        function cancelComment() {
          const mark = editor.querySelector(`mark[data-id="${commentForm.commentId.value}"]`);
          const markParent = mark.parentElement;
          const textNode = document.createTextNode(mark.innerHTML);
          mark.parentElement.replaceChild(textNode, mark);
          markParent.normalize();
          hideCommentForm();
          refreshUi();
        }

        /**
         * Calls an injected outside function to close the editor.
         */
        function closeEditor() {
          console.error('closeEditor', 'implement');
        }
      }
    };
  }]);

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