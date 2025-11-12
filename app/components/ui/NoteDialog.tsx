"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

interface NoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

export default function NoteDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  placeholder = "Add a note or remark (optional)...",
  confirmText = "Confirm",
  cancelText = "Cancel",
}: NoteDialogProps) {
  const [note, setNote] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(note);
    setNote("");
  };

  const handleClose = () => {
    setNote("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
          onClick={handleClose}
        />

        {/* Dialog panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {title}
              </h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {message}
              </p>
              <label
                htmlFor="note-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Note / Remark (Optional)
              </label>
              <textarea
                id="note-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 dark:bg-blue-700 text-base font-medium text-white hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
            >
              {confirmText}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

