const fs = require('fs');
const TaskNote = require('../models/taskNotes.model');
const { notifyNoteAdded } = require('../utils/notificationHelper');
const { getAccountName } = require('../utils/roleLookup');
const { uploadFileToDrive } = require('../utils/googleDrive');

// get all task notes
exports.getTaskNotes = (req, res) => {
    TaskNote.getAll((err, results) => {
        if (err) return res.status(500).json({ error: 'Database Error' });
        res.json({ data: results });
    });
};

// create a new task note — supports plain text, a shared link, or an
// uploaded file. Uploaded files are relayed to Google Drive (the local
// copy multer wrote to disk is temporary and always cleaned up
// afterward, whether the Drive upload succeeds or fails).
exports.createTaskNote = async (req, res) => {
    const { task_id, content, link } = req.body;
    const { id: authorId, role } = req.user;
    const uploadedFile = req.file; // present when multipart/form-data included a file

    if (!task_id || (!content && !link && !uploadedFile)) {
        if (uploadedFile) fs.unlink(uploadedFile.path, () => {});
        return res.status(400).json({ error: "task_id and at least one of content, link, or a file are required" });
    }

    getAccountName(role, authorId, async (nameErr, authorName) => {
        if (nameErr) {
            if (uploadedFile) fs.unlink(uploadedFile.path, () => {});
            return res.status(404).json({ error: 'Author account not found' });
        }

        let attachment_url = null;
        let attachment_name = null;
        let attachment_type = null;

        try {
            if (uploadedFile) {
                const driveFile = await uploadFileToDrive(
                    uploadedFile.path,
                    uploadedFile.originalname,
                    uploadedFile.mimetype
                );
                attachment_url = driveFile.viewUrl;
                attachment_name = driveFile.name;
                attachment_type = 'drive';
            } else if (link) {
                attachment_url = link;
                attachment_name = link;
                attachment_type = 'link';
            }
        } catch (uploadErr) {
            console.error('Google Drive upload failed:', uploadErr.message);
            return res.status(502).json({ error: 'Failed to upload file to Google Drive. Please try again.' });
        } finally {
            // Always clean up the local temp copy — it was only staging
            // for the Drive upload, never meant to persist on this disk.
            if (uploadedFile) fs.unlink(uploadedFile.path, () => {});
        }

        const newTaskNote = {
            task_id,
            authorRole: role,
            authorId,
            authorName,
            content: content || '',
            attachment_url,
            attachment_name,
            attachment_type,
        };

        TaskNote.create(newTaskNote, (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Error creating new Task note' });
            }

            notifyNoteAdded(task_id, authorName, authorId, content || `Shared ${attachment_type === 'drive' ? 'a file' : 'a link'}`).catch(err =>
                console.error('Notification error (note added):', err)
            );

            TaskNote.getByTaskId(task_id, (fetchErr, notes) => {
                if (fetchErr) {
                    return res.status(500).json({ error: 'Error fetching task notes' });
                }

                res.status(201).json({ success: true, data: notes });
            });
        });
    });
};
