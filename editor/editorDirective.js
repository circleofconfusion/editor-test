(function() {

  'use strict';

  angular.module('editorTest').directive('appEditor', [function() {
    return {
      scope: {
        text: '<?',
        onsave: '&',
        onsavecomment: '&',
        editorTitle: '@?',
        closeable: '<?'
      },
      templateUrl: '/editor/editor.html',
      link: function(scope, elem) {
        // Set all enter key presses to be new paragraphs
        document.execCommand('defaultParagraphSeparator', false, 'p');

        //=====================================================================
        // Variable Declarations
        //=====================================================================

        const DEFAULT_TEXT = '<p>Add text...</p>';
        const allowedEditorTags = ['p', 'mark'];
        
        // Shadow variable to run in parallel with the editor.innerHTML.
        // Represents the last known state of the editor element.
        // This will be updated by the debounced keyup handler on the editor element.
        let editorHTML;

        // Stacks used for undo/redo on the editorHTML.
        let undoStack = [];
        let redoStack = [];

        // DOM handles
        const appEditor = elem[0],
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
          editorHTML = sanitizeHtml(DEFAULT_TEXT, { allowedTags: allowedEditorTags });
        } else {
          editorHTML = sanitizeHtml(scope.text, { allowedTags: allowedEditorTags });
        }
        
        editor.innerHTML = editorHTML;

        if (scope.closeable !== true) {
          closeButton.style.display = 'none';
        }
        
        //=====================================================================
        // Event Listeners
        //=====================================================================

        appEditor.addEventListener('focusout', refreshUi);
        undoButton.addEventListener('click', undo);
        redoButton.addEventListener('click', redo);
        commentButton.addEventListener('click', insertComment);
        closeButton.addEventListener('click', closeEditor);
        editor.addEventListener('focus', editorFocus);
        editor.addEventListener('blur', editorBlur);
        editor.addEventListener('keydown', handleKeydown);
        // TODO: move the keyup handler to the appEditor element so that undo/redo works after clicking toolbar buttons.
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
          const selection = document.getSelection();
          const selectionRange = selection.getRangeAt(0);
          if (selection.anchorNode.parentElement.offsetParent === appEditor && selectionRange.startOffset < selectionRange.endOffset) {
            commentButton.disabled = false;
          } else {
            commentButton.disabled = true;
          }
        }

        function editorFocus() {
          toolbar.style.visibility = 'visible';

          if (editor.innerHTML === DEFAULT_TEXT) {
            editor.innerHTML = '';
            document.execCommand('insertHtml', false, '<p></p>');
          }

          refreshUi();
        }

        function editorBlur() {
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
          let value = sanitizeHtml(editor.innerHTML, allowedEditorTags);
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
          
          addUndoItem();
          refreshUi();
        }

        function handlePaste(evt) {
          const paste = (evt.clipboardData || window.clipboardData)
            .getData('text')
            .replace(/\n/g, '</p><p>');
          
          document.execCommand('insertHTML', false, paste);
          
          evt.preventDefault();
          refreshUi();
        }

        function addUndoItem() {
          if (editor.innerHTML !== editorHTML) {
            // push the new value to the undo stack
            undoStack.push(editorHTML);
            editorHTML = sanitizeHtml(editor.innerHTML, allowedEditorTags);
            // since this is a new value, clear the redo stack
            redoStack = [];
          }
        }

        function undo() {
          hideCommentForm();
          if (undoStack.length > 0) {
            redoStack.push(editorHTML);
            editorHTML = undoStack.pop();
            editor.innerHTML = editorHTML;
          }
          refreshUi();
        }

        function redo() {
          if (redoStack.length > 0) {
            undoStack.push(editorHTML);
            editorHTML = redoStack.pop();
            editor.innerHTML = editorHTML;
          }
          refreshUi();
        }

        function insertComment() {
          const selection = document.getSelection();
          const commentId = Math.random().toString(36).substr(2, 9);
          
          // add a mark element to the text
          document.execCommand('insertHTML', false, `<mark data-id="${commentId}">${selection.toString()}</mark>`);
          
          showCommentForm(selection, commentId);
        }

        function showCommentForm(selection, commentId) {
          // need to do this first so commentForm has an offset dimensions > 0
          commentForm.style.display = 'grid';

          const selectionBoundingRect = selection.getRangeAt(0).getBoundingClientRect();
          const left = selectionBoundingRect.x + selectionBoundingRect.width / 2 - appEditor.offsetLeft;
          const top = selectionBoundingRect.y - appEditor.offsetTop - commentForm.offsetHeight;
          
          commentForm.commentId.value = commentId;
          // TODO: make the positioning of the comment form a bit smarter to handle odd scrolling situations
          // TODO: add triangle element that points to selection
          commentForm.style.left = `${left}px`;
          commentForm.style.top = `${top}px`;
          commentTextarea.focus();
        }

        function hideCommentForm() {
          commentForm.reset();
          commentForm.style.display = 'none';
        }

        function commentFormSpecialKeys(evt) {
          if (evt.key === 'Enter' && !evt.shiftKey) {
            evt.preventDefault();
            saveComment();
          }

          // If escape key is pressed, cancel submission.
          if (evt.key === 'Escape') {
            cancelComment();
          }
        }

        function saveComment() {
          scope.onsavecomment({
            commentId: commentForm.commentId.value,
            commentText: commentForm.comment.value
          });
          addUndoItem();
          hideCommentForm();
          refreshUi();
        }
         
        function cancelComment() {

          const mark = editor.querySelector(`mark[data-id="${commentForm.commentId.value}"]`);
          const textNode = document.createTextNode(mark.innerHTML);
          mark.parentElement.replaceChild(textNode, mark);
          hideCommentForm();
          refreshUi();
        }

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